#!/usr/bin/env node
/**
 * apply-schema-9.2.mjs — Phase 9.2 anti-bot 스키마 적용
 * supabase/schema-9.2-anti-bot.sql 을 Management API 로 실행한다.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SUPABASE_PROJECT =
  process.env.SUPABASE_PROJECT_ID ?? "nbfoifegbamvtwffbuxv";
const SUPABASE_MGMT_KEY =
  process.env.SUPABASE_MANAGEMENT_KEY ?? "sbp_89c746b449276bc938624989a10290c916cd7809";
const MGMT_BASE = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`;

async function runSql(sql, label) {
  const res = await fetch(MGMT_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_MGMT_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok || (typeof json === "object" && !Array.isArray(json) && json.error)) {
    throw new Error(`${label}: ${JSON.stringify(json)}`);
  }
  console.log(`${label}: OK`);
  return json;
}

async function main() {
  const sqlPath = resolve(ROOT, "supabase/schema-9.2-anti-bot.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  console.log(`[apply-schema-9.2] ${sqlPath}`);
  await runSql(sql, "schema-9.2-anti-bot.sql");

  console.log(`\n[verify] columns`);
  const verify = await runSql(
    `select column_name from information_schema.columns
      where table_name in ('post_discussions','discussion_replies','community_posts')
        and column_name in ('ip_hash','view_count')
      order by table_name,column_name;`,
    "verify"
  );
  console.log(verify);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
