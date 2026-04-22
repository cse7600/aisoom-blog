import { Fragment } from "react";
import { NativeAdCard, type AdVariant } from "./NativeAdCard";

interface ContentWithAdsProps {
  contentHtml: string;
  category: string;
  title: string;
  tags?: string[] | null;
}

const HUMIDIFIER_KEYWORDS = ["가습기", "습도", "건조", "수분", "살균", "물통", "가습", "저온가열", "초음파"];
const AIR_PURIFIER_KEYWORDS = ["공기청정기", "미세먼지", "pm2.5", "hepa", "공기질", "청정", "필터", "초미세먼지"];
const BABY_CARE_KEYWORDS = ["아이방", "신생아", "산후", "육아", "어린이집", "아기", "영아", "유아"];

type AdDomain = "humidifier" | "air-purifier" | "baby-care";
type AdIntent = "safety" | "compare" | "review" | "guide" | "default";

function detectDomain(category: string, title: string, tags?: string[] | null): AdDomain {
  const haystack = [category, title, ...(tags ?? [])].join(" ").toLowerCase();

  const humidifierHit = HUMIDIFIER_KEYWORDS.some((kw) => haystack.includes(kw));
  if (humidifierHit) return "humidifier";

  const airHit = AIR_PURIFIER_KEYWORDS.some((kw) => haystack.includes(kw));
  if (airHit) return "air-purifier";

  const babyHit = BABY_CARE_KEYWORDS.some((kw) => haystack.includes(kw));
  if (babyHit) return "baby-care";

  if (category === "humidifier") return "humidifier";
  if (category === "air-purifier") return "air-purifier";
  if (category === "baby-care") return "baby-care";

  return "humidifier";
}

/**
 * 제목에서 사용자 구매 여정 단계(TPO의 Time)를 감지한다.
 * - safety: 인식(Awareness) — 위험/세균/주의 키워드
 * - compare: 비교(Consideration) — vs/차이/비교 키워드
 * - review: 결정(Decision) — 후기/리뷰/솔직 키워드
 * - guide: 정보 탐색 — 방법/계산/청소/주기 키워드
 * - default: 기타
 */
function detectIntent(title: string): AdIntent {
  const t = title.toLowerCase();
  if (["주의", "세균", "위험", "경고", "오해"].some((k) => t.includes(k))) return "safety";
  if (["비교", "vs", "차이", "추천"].some((k) => t.includes(k))) return "compare";
  if (["후기", "리뷰", "사용기", "솔직"].some((k) => t.includes(k))) return "review";
  if (["q&a", "방법", "계산", "위치", "청소", "주기", "얼마"].some((k) => t.includes(k))) return "guide";
  return "default";
}

function pickInlineVariants(domain: AdDomain, intent: AdIntent): AdVariant[] {
  if (domain === "humidifier") {
    if (intent === "safety") return ["humidifier-safe", "humidifier-review", "humidifier-vs"];
    if (intent === "compare") return ["humidifier-vs", "humidifier-safe", "humidifier-review"];
    if (intent === "review") return ["humidifier-review", "humidifier-vs", "humidifier-safe"];
    if (intent === "guide") return ["humidifier-safe", "humidifier-review", "humidifier-vs"];
    return ["humidifier-safe", "humidifier-review", "humidifier-vs"];
  }
  if (domain === "air-purifier") {
    if (intent === "compare") return ["air-compact", "air-silent", "air-baby"];
    if (intent === "review") return ["air-baby", "air-compact", "air-silent"];
    return ["air-compact", "air-baby", "air-silent"];
  }
  // baby-care
  if (intent === "safety") return ["air-baby", "humidifier-safe", "humidifier-review"];
  return ["air-baby", "humidifier-safe", "humidifier-review"];
}

function pickSidebarVariants(domain: AdDomain, intent: AdIntent): AdVariant[] {
  if (domain === "humidifier") {
    if (intent === "compare") return ["humidifier-vs", "humidifier-review"];
    if (intent === "review") return ["humidifier-review", "humidifier-vs"];
    return ["humidifier-safe", "humidifier-review"];
  }
  if (domain === "air-purifier") {
    if (intent === "compare") return ["air-compact", "air-silent"];
    return ["air-compact", "air-baby"];
  }
  if (intent === "safety") return ["air-baby", "humidifier-safe"];
  return ["air-baby", "humidifier-safe"];
}

/**
 * FAQ H2 시작 위치 탐지.
 * "자주 묻는 질문" | "FAQ" | "Q&A" 키워드 포함 H2의 시작 인덱스 반환.
 * 없으면 -1.
 */
function findFaqH2Index(html: string): number {
  const faqPattern = /<h2[^>]*>[^<]*(자주\s*묻는\s*질문|FAQ|Q&A)[^<]*<\/h2>/i;
  const match = faqPattern.exec(html);
  return match ? match.index : -1;
}

/**
 * HTML을 H2 태그 경계로 분할.
 * 각 청크는 자체 H2로 시작 (첫 청크만 H2 이전 intro 포함).
 */
function splitByH2(html: string): string[] {
  const h2OpenPattern = /<h2(\s[^>]*)?>/gi;
  const indices: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = h2OpenPattern.exec(html)) !== null) {
    indices.push(match.index);
  }

  if (indices.length === 0) return [html];

  const firstIdx = indices[0] ?? 0;
  const chunks: string[] = [];
  if (firstIdx > 0) {
    chunks.push(html.slice(0, firstIdx));
  }

  for (let i = 0; i < indices.length; i += 1) {
    const start = indices[i] ?? 0;
    const nextIdx = indices[i + 1];
    const end = nextIdx !== undefined ? nextIdx : html.length;
    chunks.push(html.slice(start, end));
  }

  return chunks;
}

interface AdSlot {
  afterChunkIndex: number;
  variant: AdVariant;
}

/**
 * 청크 배열과 H2 개수를 기반으로 광고 슬롯 계산.
 * 규칙:
 * - H2 2~3개: 본문 33%, 66% 지점 (chunk 1, 2 이후)
 * - H2 4~5개: 2번째 H2 종료 후, 4번째 H2 종료 후
 * - H2 6개 이상: 2번째, 4번째, FAQ 직전
 * - FAQ H2가 있으면 FAQ 이전까지만 삽입
 */
function computeAdSlots(
  chunks: string[],
  variants: AdVariant[],
  faqH2Index: number,
): AdSlot[] {
  const h2Count = chunks.filter((chunk) => /^<h2(\s|>)/i.test(chunk)).length;
  if (h2Count < 2) return [];

  const variantA = variants[0];
  const variantB = variants[1];
  const variantC = variants[2];
  if (!variantA || !variantB) return [];

  // FAQ가 있는 청크 인덱스 찾기
  let faqChunkIndex = -1;
  if (faqH2Index >= 0) {
    let cursor = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkLen = (chunks[i] ?? "").length;
      const chunkStart = cursor;
      const chunkEnd = chunkStart + chunkLen;
      if (faqH2Index >= chunkStart && faqH2Index < chunkEnd) {
        faqChunkIndex = i;
        break;
      }
      cursor = chunkEnd;
    }
  }

  const firstChunk = chunks[0] ?? "";
  const firstChunkIsIntro = !/^<h2(\s|>)/i.test(firstChunk);
  const h2StartOffset = firstChunkIsIntro ? 1 : 0;

  const slots: AdSlot[] = [];

  if (h2Count >= 6) {
    const second = h2StartOffset + 1;
    const fourth = h2StartOffset + 3;
    const beforeFaq = faqChunkIndex > 0 ? faqChunkIndex - 1 : chunks.length - 2;
    slots.push({ afterChunkIndex: second, variant: variantA });
    slots.push({ afterChunkIndex: fourth, variant: variantB });
    if (variantC && beforeFaq > fourth) {
      slots.push({ afterChunkIndex: beforeFaq, variant: variantC });
    }
  } else if (h2Count >= 4) {
    const second = h2StartOffset + 1;
    const fourth = h2StartOffset + 3;
    slots.push({ afterChunkIndex: second, variant: variantA });
    slots.push({ afterChunkIndex: fourth, variant: variantB });
  } else {
    // h2Count 2~3: 본문 33% / 66%
    const third = Math.floor(chunks.length / 3);
    const twoThird = Math.floor((chunks.length * 2) / 3);
    slots.push({ afterChunkIndex: Math.max(third, h2StartOffset), variant: variantA });
    if (twoThird > third) {
      slots.push({ afterChunkIndex: twoThird, variant: variantB });
    }
  }

  // FAQ 이후 삽입 방지
  if (faqChunkIndex >= 0) {
    return slots.filter((slot) => slot.afterChunkIndex < faqChunkIndex);
  }

  // 중복 인덱스 제거
  const seen = new Set<number>();
  return slots.filter((slot) => {
    if (seen.has(slot.afterChunkIndex)) return false;
    seen.add(slot.afterChunkIndex);
    return true;
  });
}

/**
 * 본문 HTML을 H2 경계로 분할하고 지정 슬롯에 네이티브 광고를 삽입한다.
 * 서버 컴포넌트로 렌더되며, 광고는 `<aside data-nosnippet>`으로 감싸
 * Google 스니펫 인용에서 제외된다.
 */
export function ContentWithAds({ contentHtml, category, title, tags }: ContentWithAdsProps) {
  if (!contentHtml) {
    return (
      <p className="text-body-md text-foreground/40 py-12 text-center">콘텐츠 준비 중입니다.</p>
    );
  }

  const domain = detectDomain(category, title, tags);
  const intent = detectIntent(title);
  const inlineVariants = pickInlineVariants(domain, intent);
  const chunks = splitByH2(contentHtml);
  const faqIndex = findFaqH2Index(contentHtml);
  const slots = computeAdSlots(chunks, inlineVariants, faqIndex);
  const slotMap = new Map<number, AdVariant>(
    slots.map((slot) => [slot.afterChunkIndex, slot.variant]),
  );

  // 광고가 삽입될 수 없을 만큼 짧은 본문은 단일 렌더
  if (slots.length === 0) {
    return (
      <div className="prose-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
    );
  }

  return (
    <>
      {chunks.map((chunk, index) => {
        const adVariant = slotMap.get(index);
        const chunkKey = `chunk-${index}`;
        return (
          <Fragment key={chunkKey}>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: chunk }}
            />
            {adVariant && (
              <aside data-nosnippet aria-label="추천" className="my-8">
                <NativeAdCard variant={adVariant} placement="inline" />
              </aside>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export function getSidebarAdVariants(
  category: string,
  title: string,
  tags?: string[] | null,
): AdVariant[] {
  const domain = detectDomain(category, title, tags);
  const intent = detectIntent(title);
  return pickSidebarVariants(domain, intent);
}
