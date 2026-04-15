#!/usr/bin/env node
/**
 * 어필리에이트 링크 교체 검증.
 * published + scheduled 포스트에서 목표 URL 외 변종이 남아 있으면 실패.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const KEEPER_TARGET = "https://keeper.ceo/security?ref=89S42E";
const STARTBIZ_TARGET = "https://k-startbiz.org/?ref=STARTBIZ_CYM";

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function findSourcesRange(text) {
  const re = /^##\s*출처\s*$/m;
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index;
  const after = text.slice(start + m[0].length);
  const nextH2 = after.search(/^##\s+[^#]/m);
  const end = nextH2 === -1 ? text.length : start + m[0].length + nextH2;
  return [start, end];
}

function checkText(text) {
  const range = findSourcesRange(text);
  const scan = range ? text.slice(0, range[0]) + text.slice(range[1]) : text;

  const keeperUrls = scan.match(/https?:\/\/(?:www\.)?keeper\.ceo[^\s\)\]"'<>]*/g) || [];
  const startbizUrls = scan.match(/https?:\/\/(?:www\.)?(?:corp\.apply\.kr|k-startbiz\.org)[^\s\)\]"'<>]*/g) || [];

  const badKeeper = keeperUrls.filter((u) => u !== KEEPER_TARGET);
  const badStartbiz = startbizUrls.filter((u) => u !== STARTBIZ_TARGET);

  return { keeperUrls: keeperUrls.length, startbizUrls: startbizUrls.length, badKeeper, badStartbiz };
}

async function main() {
  loadEnv();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, slug, status, content")
    .in("status", ["published", "scheduled"]);
  if (error) throw error;

  let totalKeeper = 0, totalStartbiz = 0, fails = 0;
  for (const post of posts) {
    if (!post.content) continue;
    const r = checkText(post.content);
    totalKeeper += r.keeperUrls;
    totalStartbiz += r.startbizUrls;
    if (r.badKeeper.length || r.badStartbiz.length) {
      fails++;
      console.log(`FAIL [${post.status}] ${post.slug}`);
      for (const u of r.badKeeper) console.log(`  keeper-bad: ${u}`);
      for (const u of r.badStartbiz) console.log(`  startbiz-bad: ${u}`);
    }
  }
  console.log(`\n[DB VERIFY] posts=${posts.length} keeper_urls=${totalKeeper} startbiz_urls=${totalStartbiz} bad_posts=${fails}`);
  if (fails > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
