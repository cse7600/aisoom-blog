/**
 * 네이버 키워드 검색량 분석
 * naver-autobid 프로젝트에서 발췌 + 블로그 SEO 용도에 맞게 최적화
 *
 * 네이버 검색광고 API /keywordstool 엔드포인트 사용
 * - PC + 모바일 월간 검색량
 * - 경쟁도 (low/medium/high)
 * - 평균 노출 깊이 (광고 경쟁)
 */

import crypto from "crypto";

const NAVER_SA_BASE = "https://api.naver.com";

export interface KeywordVolume {
  keyword: string;
  pcVolume: number;
  mobileVolume: number;
  totalVolume: number;
  competition: "low" | "medium" | "high" | null;
  avgDepth: number | null;
  pcAvgCtr: number | null;
}

function buildNaverSaHeaders(path: string): Record<string, string> {
  const apiKey = process.env.NAVER_API_KEY;
  const secretKey = process.env.NAVER_SA_SECRET;
  const customerId = process.env.NAVER_ACCOUNT_ID;

  if (!apiKey || !secretKey || !customerId) {
    throw new Error("NAVER_API_KEY / NAVER_SA_SECRET / NAVER_ACCOUNT_ID 미설정");
  }

  const ts = String(Date.now());
  const sig = crypto
    .createHmac("sha256", secretKey)
    .update(`${ts}.GET.${path}`)
    .digest("base64");

  return {
    "X-Timestamp": ts,
    "X-API-KEY": apiKey,
    "X-Customer": customerId,
    "X-Signature": sig,
  };
}

function parseVolume(raw: unknown): number {
  if (raw === "< 10" || raw == null) return 0;
  return Number(raw) || 0;
}

function parseCompetition(raw: unknown): "low" | "medium" | "high" | null {
  if (raw === "낮음" || raw === "LOW") return "low";
  if (raw === "중간" || raw === "MID") return "medium";
  if (raw === "높음" || raw === "HIGH") return "high";
  return null;
}

/**
 * 키워드 목록의 네이버 검색량 조회
 * 5개씩 배치 처리 (API 제한)
 */
export async function fetchKeywordVolumes(
  keywords: string[]
): Promise<KeywordVolume[]> {
  const results: KeywordVolume[] = [];
  const BATCH = 5;

  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch = keywords.slice(i, i + BATCH);
    const qs = new URLSearchParams({
      hintKeywords: batch.join(","),
      showDetail: "1",
    });
    const path = "/keywordstool";

    const res = await fetch(`${NAVER_SA_BASE}${path}?${qs}`, {
      headers: buildNaverSaHeaders(path),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Naver SA API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { keywordList?: Record<string, unknown>[] };

    for (const item of data.keywordList ?? []) {
      const kw = item.relKeyword as string;
      if (!batch.includes(kw)) continue;

      const pc = parseVolume(item.monthlyPcQcCnt);
      const mobile = parseVolume(item.monthlyMobileQcCnt);

      results.push({
        keyword: kw,
        pcVolume: pc,
        mobileVolume: mobile,
        totalVolume: pc + mobile,
        competition: parseCompetition(item.compIdx),
        avgDepth: item.plAvgDepth != null ? Number(item.plAvgDepth) : null,
        pcAvgCtr: item.monthlyAvgPcCtr != null ? Number(item.monthlyAvgPcCtr) : null,
      });
    }

    if (i + BATCH < keywords.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

/**
 * 단일 키워드 검색량 조회
 */
export async function getSingleKeywordVolume(
  keyword: string
): Promise<KeywordVolume | null> {
  const results = await fetchKeywordVolumes([keyword]);
  return results.find((r) => r.keyword === keyword) ?? null;
}

/**
 * 검색량 기반 SEO 난이도 점수 (0~100)
 * totalVolume이 높고 competition이 낮을수록 기회 점수가 높음
 */
export function calcKeywordOpportunity(kv: KeywordVolume): number {
  const volumeScore = Math.min(kv.totalVolume / 100_000, 1) * 60;
  const compScore =
    kv.competition === "low" ? 40 : kv.competition === "medium" ? 20 : 0;
  return Math.round(volumeScore + compScore);
}
