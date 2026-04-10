#!/usr/bin/env node
/**
 * apply-persona-seeds.mjs
 *
 * 어필리에이트별 페르소나 시드 SQL을 Supabase에 적용한다.
 * 사용: node scripts/apply-persona-seeds.mjs [--affiliate 밀리의서재]
 *       node scripts/apply-persona-seeds.mjs --all
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUPABASE_PROJECT = process.env.SUPABASE_PROJECT_ID ?? 'nbfoifegbamvtwffbuxv';
const SUPABASE_MGMT_KEY = process.env.SUPABASE_MANAGEMENT_KEY ?? 'sbp_89c746b449276bc938624989a10290c916cd7809';
const MGMT_BASE = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`;

async function runSql(sql, label) {
  const res = await fetch(MGMT_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_MGMT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const json = await res.json();
  if (!res.ok || (typeof json === 'object' && !Array.isArray(json) && json.error)) {
    throw new Error(`${label}: ${JSON.stringify(json)}`);
  }
  const rows = Array.isArray(json) ? json.length : 0;
  console.log(`${label}: OK (rows=${rows})`);
}

async function applyFile(filePath, label) {
  if (!existsSync(filePath)) {
    console.warn(`  SKIP (not found): ${filePath}`);
    return;
  }
  const sql = readFileSync(filePath, 'utf-8');
  await runSql(sql, label);
}

async function getPersonaCount() {
  const res = await fetch(MGMT_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_MGMT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'select count(*)::int as cnt from discussion_personas' }),
  });
  const json = await res.json();
  return Array.isArray(json) && json[0] ? json[0].cnt : '?';
}

const args = process.argv.slice(2);
const allMode = args.includes('--all');
const affiliateArg = args[args.indexOf('--affiliate') + 1];

const affiliatesConfig = JSON.parse(
  readFileSync(resolve(ROOT, 'content-input/affiliates.json'), 'utf-8'),
);

/** 적용 대상 어필리에이트 목록 */
const targets = allMode
  ? affiliatesConfig.affiliates.filter((a) => a.personaSeedFile)
  : affiliatesConfig.affiliates.filter(
      (a) => a.personaSeedFile && (!affiliateArg || a.name === affiliateArg),
    );

if (targets.length === 0) {
  console.error('적용 대상 없음. --all 또는 --affiliate <이름> 확인');
  process.exit(1);
}

console.log(`\n=== Persona Seed 적용 시작 (${targets.length}개) ===\n`);

for (const affiliate of targets) {
  const seedPath = resolve(ROOT, affiliate.personaSeedFile);
  await applyFile(seedPath, `[${affiliate.name}] ${affiliate.personaSeedFile}`);
}

const total = await getPersonaCount();
console.log(`\n현재 총 페르소나 수: ${total}명`);
