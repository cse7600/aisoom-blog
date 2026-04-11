#!/usr/bin/env node
/**
 * 새 콘텐츠 초안 생성 스크립트
 *
 * Usage:
 *   node scripts/new-content.mjs --affiliate 키퍼메이트 --topic "카페 CCTV 설치비용" --keywords "카페CCTV 카페CCTV설치비용 카페보안카메라"
 *   node scripts/new-content.mjs --affiliate 법인설립지원센터 --topic "개인사업자 법인전환" --keywords "개인사업자법인전환 법인전환시기"
 *
 * 실행 흐름:
 *   1. 네이버 키워드 리서치 (keyword-research.mjs 로직 재사용)
 *   2. 상위 키워드 기반 frontmatter 자동 완성
 *   3. CONTENT_TEMPLATE.md 기반으로 초안 파일 생성
 *   4. 완료 시 파일 경로 출력 → 사용자가 직접 작성
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── 환경변수 ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ─── 어필리에이트 메타 (affiliates.json에서 동적 로드) ──────────────────────

function loadAffiliates() {
  const filePath = path.join(ROOT, "content-input", "affiliates.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`affiliates.json 없음: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const affiliateMap = {};
  for (const aff of parsed.affiliates) {
    affiliateMap[aff.name] = {
      dir: aff.contentDir,
      category: aff.category,
      url: aff.url,
      disclosure: aff.disclosure,
      author: aff.author ?? "고른다 에디터",
    };
  }
  return affiliateMap;
}

const AFFILIATES = loadAffiliates();

// ─── Naver API ─────────────────────────────────────────────────────────────

function buildHeaders(urlPath) {
  const { NAVER_API_KEY: key, NAVER_SA_SECRET: secret, NAVER_ACCOUNT_ID: id } = process.env;
  if (!key || !secret || !id) throw new Error("NAVER_API_KEY / NAVER_SA_SECRET / NAVER_ACCOUNT_ID 미설정");
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.GET.${urlPath}`).digest("base64");
  return { "X-Timestamp": ts, "X-API-KEY": key, "X-Customer": id, "X-Signature": sig };
}

async function fetchKeywordStats(keywords) {
  const urlPath = "/keywordstool";
  const params = new URLSearchParams({ hintKeywords: keywords.join(","), showDetail: "1" });
  const url = `https://api.naver.com${urlPath}?${params}`;
  const res = await fetch(url, { headers: buildHeaders(urlPath) });
  if (!res.ok) throw new Error(`Naver API ${res.status}`);
  const { keywordList } = await res.json();
  return keywordList ?? [];
}

function score(kw) {
  const vol = (kw.monthlyPcQcCnt || 0) + (kw.monthlyMobileQcCnt || 0);
  if (vol === 0) return 0;
  const compMap = { "낮음": 40, "중간": 20, "높음": 0 };
  const comp = compMap[kw.compIdx] ?? 20;
  const volScore = Math.min(60, Math.round((Math.log10(vol + 1) / Math.log10(500000)) * 60));
  return volScore + comp;
}

// ─── slug 생성 ─────────────────────────────────────────────────────────────

function toSlug(topic) {
  return topic
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ-]/g, "")
    // 한글 → 로마자 변환은 수동으로 (파일명에 한글 허용)
    .replace(/[^\w-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const affiliateName = get("--affiliate");
  const topic = get("--topic");
  const keywordsRaw = get("--keywords");

  if (!affiliateName || !topic) {
    console.error(`
사용법:
  node scripts/new-content.mjs --affiliate 키퍼메이트 --topic "카페 CCTV 설치비용" --keywords "카페CCTV 카페CCTV설치비용"
  node scripts/new-content.mjs --affiliate 법인설립지원센터 --topic "개인사업자 법인전환"
`);
    process.exit(1);
  }

  const affiliate = AFFILIATES[affiliateName];
  if (!affiliate) {
    console.error(`알 수 없는 어필리에이트: ${affiliateName}`);
    console.error(`가능한 값: ${Object.keys(AFFILIATES).join(", ")}`);
    process.exit(1);
  }

  // 키워드 리서치
  const seedKeywords = keywordsRaw ? keywordsRaw.split(/\s+/) : [topic.replace(/\s/g, "")];
  console.log(`\n키워드 리서치 중: ${seedKeywords.join(", ")} ...`);

  let topKeywords = [];
  try {
    const kwList = await fetchKeywordStats(seedKeywords);
    topKeywords = kwList
      .map((k) => ({
        keyword: k.relKeyword,
        volume: (k.monthlyPcQcCnt || 0) + (k.monthlyMobileQcCnt || 0),
        comp: k.compIdx,
        score: score(k),
      }))
      .filter((k) => k.volume > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    console.log("\n상위 키워드:");
    topKeywords.forEach((k, i) =>
      console.log(`  ${i + 1}. ${k.keyword} — 월 ${k.volume.toLocaleString()}건 / 경쟁: ${k.comp} / 점수: ${k.score}`)
    );
  } catch (err) {
    console.warn(`키워드 리서치 실패 (건너뜀): ${err.message}`);
  }

  // frontmatter 자동 완성
  const today = new Date().toISOString().split("T")[0];
  const mainKw = topKeywords[0]?.keyword ?? seedKeywords[0];
  const subKws = topKeywords.slice(1, 5).map((k) => k.keyword);
  const slugBase = toSlug(topic);
  const slug = `${slugBase}-${today}`;

  // 초안 파일 생성
  const template = fs.readFileSync(path.join(ROOT, "content-input/CONTENT_TEMPLATE.md"), "utf-8");

  const draft = template
    .replace("[제목 — 60자 이내, 검색 의도 반영]", `${topic} — [부제목 추가 필요]`)
    .replace("[영문-슬러그]", slug)
    .replace("[SEO 디스크립션 — 120~160자, 핵심 키워드 포함]", `${topic}에 대해 정리합니다. [설명 작성 필요]`)
    .replace("[tech | finance | beauty | travel | home-living]", affiliate.category)
    .replace("[메인 키워드]", mainKw)
    .replace('["서브 키워드1", "서브 키워드2", "서브 키워드3"]', JSON.stringify(subKws))
    .replace("[YYYY-MM-DD]", today)
    .replace("[어필리에이트 이름]", affiliateName)
    .replace("[어필리에이트 URL]", affiliate.url)
    .replace("[공시 문구 — 어필리에이트별 적합한 문구]", affiliate.disclosure)
    .replace("[공시 문구 반복]", affiliate.disclosure);

  const outDir = path.join(ROOT, affiliate.dir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.md`);
  fs.writeFileSync(outPath, draft);

  // 키워드 리서치 결과도 저장
  if (topKeywords.length > 0) {
    const kwDir = path.join(ROOT, "content-input/keywords");
    fs.mkdirSync(kwDir, { recursive: true });
    const kwPath = path.join(kwDir, `${today}-${slugBase}.json`);
    fs.writeFileSync(kwPath, JSON.stringify({ topic, keywords: topKeywords }, null, 2));
    console.log(`\n키워드 저장: ${kwPath}`);
  }

  console.log(`
초안 생성 완료!
─────────────────────────────────────────────
파일: ${outPath}
─────────────────────────────────────────────
다음 단계:
  1. 위 파일을 열어서 본문 작성
  2. npm run publish-post -- ${path.relative(ROOT, outPath)}
  3. npm run generate-image -- ${path.relative(ROOT, outPath)}
─────────────────────────────────────────────
`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
