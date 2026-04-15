#!/usr/bin/env node
/**
 * 로컬 마크다운 파일을 다시 HTML로 변환해 Supabase `posts.content`만 갱신.
 * published_at / created_at / status 등은 건드리지 않는다.
 *
 * 사용법:
 *   node scripts/resync-content-db.mjs --dry          # 영향 범위 확인
 *   node scripts/resync-content-db.mjs                # 실제 PATCH
 *   node scripts/resync-content-db.mjs --slug my-slug # 단건
 */

import fs from 'node:fs';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { marked } from 'marked';

const ROOT = path.resolve(process.argv[1], '..', '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const slugIdx = args.indexOf('--slug');
const onlySlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

// env 로드
const envPath = path.join(ROOT, '.env.local');
if (!fs.existsSync(envPath)) throw new Error('.env.local 없음');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase env 누락');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const yaml = m[1];
  const content = m[2].trim();
  const slugLine = yaml.match(/^slug:\s*(.+)$/m);
  const slug = slugLine ? slugLine[1].trim().replace(/^["']|["']$/g, '') : null;
  return { slug, content };
}

async function collectMd() {
  const roots = ['키퍼메이트/content', '법인설립지원센터/content'];
  const out = [];
  for (const r of roots) {
    const abs = path.resolve(ROOT, r);
    try {
      const entries = await readdir(abs, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isFile() && ent.name.endsWith('.md')) {
          out.push(path.join(abs, ent.name));
        }
      }
    } catch { /* 폴더 없음 */ }
  }
  return out;
}

async function patchContent(slug, html) {
  const url = `${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ content: html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${res.status}: ${t}`);
  }
}

async function checkExists(slug) {
  const url = `${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}&select=id,slug`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const files = await collectMd();
  let matched = 0;
  let patched = 0;
  let missing = 0;

  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed || !parsed.slug) continue;
    if (onlySlug && parsed.slug !== onlySlug) continue;

    const exists = await checkExists(parsed.slug);
    if (!exists) {
      missing++;
      console.log(`[MISS] ${parsed.slug} — DB에 없음 (미발행 추정)`);
      continue;
    }
    matched++;

    const html = marked.parse(parsed.content);
    const rel = path.relative(ROOT, f);
    if (dry) {
      console.log(`[DRY ] ${parsed.slug} — ${rel} (HTML ${html.length}자)`);
    } else {
      await patchContent(parsed.slug, html);
      patched++;
      console.log(`[PATCH] ${parsed.slug} — ${html.length}자 업데이트`);
    }
  }

  console.log('');
  console.log(`로컬 MD: ${files.length}`);
  console.log(`DB 매칭: ${matched}`);
  console.log(`DB 없음: ${missing}`);
  if (!dry) console.log(`실제 업데이트: ${patched}`);
  if (dry) console.log('모드: DRY RUN');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
