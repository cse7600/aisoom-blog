#!/usr/bin/env node
/**
 * 마크다운 파일에서 `**...**` 볼드 마커를 제거한다.
 *
 * 보호 구간:
 *  - frontmatter (첫 `---` ~ 두번째 `---` 사이)
 *  - 코드펜스 (``` ~ ```)
 *  - 인라인 코드 (`...`) 내부의 `**`
 *
 * 사용법:
 *   node scripts/strip-bold-markers.mjs --dry  # 드라이런
 *   node scripts/strip-bold-markers.mjs         # 실제 적용
 *   node scripts/strip-bold-markers.mjs --path 키퍼메이트/content  # 특정 경로
 */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';

const ROOT = resolve(process.argv[1], '..', '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const pathArgIndex = args.indexOf('--path');
const targets = pathArgIndex >= 0
  ? [args[pathArgIndex + 1]]
  : ['키퍼메이트/content', '법인설립지원센터/content'];

/** 재귀적으로 .md 파일 수집 */
async function collectMd(dir) {
  const abs = resolve(ROOT, dir);
  const out = [];
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const ent of entries) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile() && ent.name.endsWith('.md')) out.push(p);
    }
  }
  await walk(abs);
  return out;
}

/**
 * 인라인 `...` 구간을 보호하면서 `**X**` → `X` 변환.
 * 백틱으로 감싸진 구간은 원문 유지.
 */
function stripBoldPreservingInlineCode(line) {
  // 세그먼트 분리: ` ` 바깥/안쪽
  const segments = [];
  let i = 0;
  let buf = '';
  let inCode = false;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '`') {
      segments.push({ code: inCode, text: buf });
      buf = '';
      inCode = !inCode;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.length > 0) segments.push({ code: inCode, text: buf });

  // 백틱 수가 홀수면 변환 위험 — 원문 유지
  const tickCount = (line.match(/`/g) || []).length;
  if (tickCount % 2 !== 0) return line;

  return segments.map(seg => {
    if (seg.code) return '`' + seg.text + '`';
    // 비코드 구간에서 **X** 제거. X는 `**`를 포함하지 않는 최소 매칭.
    // 같은 라인 여러 쌍 처리 위해 /g.
    return seg.text.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
  }).join('').replace(/`$/, (m, offset, str) => {
    // 마지막 세그먼트가 코드였으면 닫는 백틱은 이미 붙어있음 — no-op
    return m;
  });
}

/**
 * 파일 전체 처리: frontmatter + 코드펜스 보호
 */
function processContent(text) {
  const lines = text.split('\n');
  let inFrontmatter = false;
  let frontmatterClosed = false;
  let inFence = false;
  let changed = 0;
  const out = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // frontmatter 경계
    if (idx === 0 && line.trim() === '---') {
      inFrontmatter = true;
      out.push(line);
      continue;
    }
    if (inFrontmatter && !frontmatterClosed && line.trim() === '---') {
      frontmatterClosed = true;
      inFrontmatter = false;
      out.push(line);
      continue;
    }
    if (inFrontmatter) {
      out.push(line); // 그대로 유지
      continue;
    }

    // 코드펜스 토글
    if (/^```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // 본문 처리
    const next = stripBoldPreservingInlineCode(line);
    if (next !== line) changed++;
    out.push(next);
  }

  return { text: out.join('\n'), changedLines: changed };
}

async function main() {
  let totalFiles = 0;
  let changedFiles = 0;
  let totalChangedLines = 0;

  for (const t of targets) {
    const files = await collectMd(t).catch(() => []);
    for (const f of files) {
      totalFiles++;
      const src = await readFile(f, 'utf8');
      const { text, changedLines } = processContent(src);
      if (text !== src) {
        changedFiles++;
        totalChangedLines += changedLines;
        const rel = f.replace(ROOT + '/', '');
        if (dryRun) {
          console.log(`[DRY] ${rel} — ${changedLines}줄 변경 예정`);
        } else {
          await writeFile(f, text, 'utf8');
          console.log(`[WRITE] ${rel} — ${changedLines}줄 수정`);
        }
      }
    }
  }

  console.log('');
  console.log(`대상 파일: ${totalFiles}`);
  console.log(`변경 파일: ${changedFiles}`);
  console.log(`변경 라인: ${totalChangedLines}`);
  if (dryRun) console.log('모드: DRY RUN (변경 미적용)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
