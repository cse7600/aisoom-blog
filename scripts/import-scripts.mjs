#!/usr/bin/env node
/**
 * Phase 9.1 각본 import 스크립트
 * content-input/scripts/*.json → Supabase community_scripts
 *
 * 사용:
 *   node scripts/import-scripts.mjs             # 전체 임포트
 *   node scripts/import-scripts.mjs --file=SCR-2026-001.json
 *   node scripts/import-scripts.mjs --dry-run   # INSERT 없이 검증만
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT, "content-input", "scripts");

loadEnv(path.join(ROOT, ".env.local"));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error("[import-scripts] fatal:", error);
  process.exit(1);
});

async function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error(`[import-scripts] directory not found: ${SCRIPTS_DIR}`);
    process.exit(1);
  }
  const files = listScriptFiles();
  console.log(`[import-scripts] found ${files.length} files`);
  const personaMap = await loadPersonaMap();
  console.log(`[import-scripts] loaded ${personaMap.size} personas`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    const result = await importOne(file, personaMap);
    if (result === "imported") imported += 1;
    else if (result === "skipped") skipped += 1;
    else failed += 1;
  }
  console.log(
    `[import-scripts] done: imported=${imported}, skipped=${skipped}, failed=${failed}`
  );
}

function listScriptFiles() {
  if (args.file) {
    return [path.join(SCRIPTS_DIR, args.file)];
  }
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(SCRIPTS_DIR, name));
}

async function importOne(filePath, personaMap) {
  const fileName = path.basename(filePath);
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`[import-scripts] ${fileName} parse error: ${error.message}`);
    return "failed";
  }
  const validation = validateSpec(spec, personaMap);
  if (validation.error) {
    console.error(`[import-scripts] ${fileName} invalid: ${validation.error}`);
    return "failed";
  }
  if (args.dryRun) {
    console.log(
      `[import-scripts] ${fileName} OK (dry-run, ${spec.comments.length} comments)`
    );
    return "imported";
  }
  const existing = await findScriptByCode(spec.script_code);
  if (existing) {
    console.log(`[import-scripts] ${fileName} already exists, skipping`);
    return "skipped";
  }
  const scriptId = await insertScript(spec, personaMap);
  if (!scriptId) return "failed";
  await insertScriptComments(scriptId, spec.comments, personaMap);
  console.log(
    `[import-scripts] ${fileName} imported (${spec.comments.length} comments)`
  );
  return "imported";
}

function validateSpec(spec, personaMap) {
  if (!spec.script_code) return { error: "script_code missing" };
  if (!spec.category) return { error: "category missing" };
  if (!spec.title) return { error: "title missing" };
  if (!spec.body) return { error: "body missing" };
  if (!spec.author_persona) return { error: "author_persona missing" };
  if (!personaMap.has(spec.author_persona))
    return { error: `author persona not found: ${spec.author_persona}` };
  if (!Array.isArray(spec.comments))
    return { error: "comments must be array" };
  for (const commentSpec of spec.comments) {
    if (typeof commentSpec.sequence !== "number")
      return { error: "comment.sequence must be number" };
    if (!commentSpec.persona)
      return { error: `comment.persona missing (seq=${commentSpec.sequence})` };
    if (!personaMap.has(commentSpec.persona))
      return {
        error: `comment persona not found: ${commentSpec.persona}`,
      };
    if (!commentSpec.content)
      return { error: `comment.content missing (seq=${commentSpec.sequence})` };
    if (typeof commentSpec.delay_minutes !== "number")
      return { error: `delay_minutes must be number (seq=${commentSpec.sequence})` };
  }
  return { error: null };
}

async function loadPersonaMap() {
  const { data, error } = await supabase
    .from("discussion_personas")
    .select("id,nickname")
    .eq("active", true);
  if (error) {
    throw new Error(`loadPersonaMap failed: ${error.message}`);
  }
  const map = new Map();
  for (const row of data ?? []) {
    map.set(row.nickname, row.id);
  }
  return map;
}

async function findScriptByCode(code) {
  const { data } = await supabase
    .from("community_scripts")
    .select("id")
    .eq("script_code", code)
    .maybeSingle();
  return data;
}

async function insertScript(spec, personaMap) {
  const { data, error } = await supabase
    .from("community_scripts")
    .insert({
      script_code: spec.script_code,
      category: spec.category,
      title: spec.title,
      body: spec.body,
      author_persona_id: personaMap.get(spec.author_persona),
      target_keyword: spec.target_keyword ?? null,
      thumb_variant: spec.thumb_variant ?? "default",
      status: "ready",
      planned_post_date: spec.planned_post_date ?? null,
      source: "import",
      tags: spec.tags ?? [],
      notes: spec.notes ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[import-scripts] insertScript:", error.message);
    return null;
  }
  return data.id;
}

async function insertScriptComments(scriptId, comments, personaMap) {
  const sequenceToId = new Map();
  for (const commentSpec of comments) {
    const parentId =
      commentSpec.parent_sequence !== undefined
        ? sequenceToId.get(commentSpec.parent_sequence) ?? null
        : null;
    const { data, error } = await supabase
      .from("community_script_comments")
      .insert({
        script_id: scriptId,
        parent_script_comment_id: parentId,
        sequence: commentSpec.sequence,
        commenter_persona_id: personaMap.get(commentSpec.persona),
        content: commentSpec.content,
        delay_minutes: commentSpec.delay_minutes,
        sentiment: commentSpec.sentiment ?? "neutral",
        status: "ready",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[import-scripts] insertScriptComment:", error.message);
      continue;
    }
    sequenceToId.set(commentSpec.sequence, data.id);
  }
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2]
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  const parsed = { file: null, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg.startsWith("--file=")) parsed.file = arg.slice(7);
  }
  return parsed;
}
