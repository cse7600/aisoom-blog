#!/usr/bin/env node
/**
 * apply-schema-9.1.mjs — Phase 9.1 스키마를 Supabase에 적용
 * supabase/schema-9.1-scripts.sql 파일을 Management API로 실행한다.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
  const sqlPath = resolve(ROOT, "supabase/schema-9.1-scripts.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  console.log(`\n=== Phase 9.1 Schema 적용 ===`);
  console.log(`파일: ${sqlPath}`);
  await runSql(sql, "schema-9.1-scripts.sql");

  console.log(`\n=== 테이블 검증 ===`);
  const tables = await runSql(
    `select tablename from pg_tables where schemaname = 'public' and tablename like 'community_script%' order by tablename`,
    "list community_script* tables"
  );
  console.log(JSON.stringify(tables, null, 2));
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
