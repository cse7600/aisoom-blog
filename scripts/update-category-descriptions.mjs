#!/usr/bin/env node
/**
 * Supabase categories 테이블의 description을 SEO 최적화 값으로 업데이트
 * Usage: node scripts/update-category-descriptions.mjs [--dry]
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── .env.local 로드 ────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local 없으면 기존 환경변수 사용
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "[error] NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
  );
  process.exit(1);
}

// ─── SEO 최적화 description 맵 ──────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS = {
  tech: "스마트폰·노트북·가전제품·보안카메라 비교 리뷰. 실사용자 경험 기반의 팩트 정보. CCTV·키퍼메이트 전문.",
  finance:
    "신용카드·적금·보험·법인설립 비용 비교 분석. 법인 설립 절차와 비용 계산법 완전 정리.",
  beauty: "화장품·건강기능식품 솔직 리뷰. 성분·효과·가격 팩트 비교.",
  "home-living":
    "생활용품·인테리어·주방용품·식자재 추천. 외식업 원가 절감 실전 가이드.",
  travel: "국내외 여행 가이드, 숙소·항공·보험 비교. 비용 절감 팁.",
};

// ─── 실행 ────────────────────────────────────────────────────────────────────

const isDry = process.argv.includes("--dry");
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // 현재 DB 상태 조회
  const { data: rows, error: fetchErr } = await db
    .from("categories")
    .select("slug, name, description")
    .in("slug", Object.keys(CATEGORY_DESCRIPTIONS));

  if (fetchErr) {
    console.error("[error] categories 조회 실패:", fetchErr.message);
    process.exit(1);
  }

  const existing = Object.fromEntries(
    (rows ?? []).map((r) => [r.slug, r])
  );

  console.log(
    isDry ? "[dry-run] 실제 업데이트 없음\n" : "[update] Supabase 업데이트 시작\n"
  );

  for (const [slug, newDesc] of Object.entries(CATEGORY_DESCRIPTIONS)) {
    const current = existing[slug];
    const currentDesc = current?.description ?? "(없음)";
    const name = current?.name ?? slug;

    console.log(`[${slug}] ${name}`);
    console.log(`  현재: ${currentDesc}`);
    console.log(`  변경: ${newDesc}`);

    if (isDry) {
      console.log("  → dry-run, 스킵\n");
      continue;
    }

    const { error } = await db
      .from("categories")
      .update({ description: newDesc })
      .eq("slug", slug);

    if (error) {
      console.error(`  [error] 업데이트 실패: ${error.message}\n`);
    } else {
      console.log("  → 완료\n");
    }
  }

  console.log(isDry ? "[dry-run] 완료" : "[update] 전체 완료");
}

run().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
