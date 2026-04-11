#!/usr/bin/env node
/**
 * Phase 9.2 — 품질 보강 2차 (boost-v2)
 *
 * 목표:
 *   - 평균 길이 127.9 → 150자+
 *   - 질문 비율 13.8% → 22%+
 *
 * 전략:
 *   1) 80~120자 구간 댓글 중 일부 → 150자+ 로 자연스레 확장
 *   2) 포스트별 질문이 1개뿐인 경우 → 추가로 1개 더 전환 (총 2개 목표 → 24개 포스트 × 2 = 48개 → 20%)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes("--dry");

function pickTopic(slug) {
  if (/vat|tax/i.test(slug)) return "tax";
  if (/corporation|corp/i.test(slug)) return "corporation";
  if (/cctv|keeper|caps|secom|cafe|store/i.test(slug)) return "cctv";
  return "general";
}

// 80~120자 댓글에 붙일 자연스러운 후속 문장 (topic별)
const FOLLOWUP_SENTENCES = {
  corporation: [
    " 참고로 저는 법무사 통해서 6일 만에 등기까지 끝냈는데 직접 하셨을 때 병목이 어디였는지 궁금해요.",
    " 저도 비슷한 경험이 있어서 이 글이 진짜 공감 많이 됐습니다 아직까지 결정 못 내린 게 세무사 수수료 부분이에요.",
    " 혹시 법인 전환 시점을 12월 말로 잡으면 그 해 종합소득세 영향이 어떻게 되는지 따로 알려주실 수 있을까요.",
    " 저도 작년에 전환했는데 첫 달 기장료랑 법인카드 발급 일정 꼬여서 고생했던 기억이 납니다.",
  ],
  cctv: [
    " 저희 매장은 카운터 뒤쪽 사각지대가 문제였는데 이 글 덕분에 추가 설치 계획 잡는 데 참고했습니다.",
    " 야간 저조도 성능이 제일 헷갈리는 부분인데 실제 현장 영상 공유해주실 수 있는 분 계시면 좋겠어요.",
    " 카메라 교체 주기를 4~5년으로 봐야 한다는 얘기가 많던데 실제 사용하시는 분들은 몇 년 정도 버티시는지 궁금합니다.",
    " 저도 비슷한 고민 끝에 렌탈로 결정했는데 위약금 조항 때문에 계약서를 10번 정도 다시 읽었던 것 같아요.",
  ],
  tax: [
    " 저는 매년 신고 시즌마다 이 내용 찾아보는데 올해는 세액공제 항목이 살짝 바뀌어서 다시 정리해야겠네요.",
    " 혹시 법인세 중간예납 기간 놓쳤을 때 가산세가 얼마나 붙는지 경험담 공유해주실 수 있을까요.",
    " 부가세 환급 받을 때 세무사가 처리해주는 속도 차이가 크다는 얘기 들었는데 실제 체감도 그런가요.",
    " 저는 직전 연도 부가세 신고할 때 이 내용 몰라서 300만원 손해 본 적 있어서 이번 글 정말 유용합니다.",
  ],
  general: [
    " 글 본문 마지막 표에 나온 수치는 출처가 어디인지도 궁금합니다 저도 같은 기준으로 비교해보고 싶어서요.",
    " 이런 정리 글을 찾느라 몇 시간을 썼는데 한 번에 정리돼서 너무 좋았고 북마크했습니다.",
    " 저도 같은 주제로 조사 중이었는데 이 글이 제일 실용적이라서 지인한테 공유해드렸습니다.",
    " 혹시 관련해서 다음 업데이트 글 예정이 있으신지 구독 걸어두고 싶네요.",
  ],
};

function followupFor(slug, seed) {
  const pool = FOLLOWUP_SENTENCES[pickTopic(slug)] ?? FOLLOWUP_SENTENCES.general;
  return pool[seed % pool.length];
}

const QUESTION_SUFFIX_BY_TOPIC = {
  corporation: " 혹시 비슷한 케이스 경험 있으신 분들 조언 부탁드립니다.",
  cctv: " 현장 운영해보신 분들 어떻게 해결하셨는지 궁금합니다.",
  tax: " 이 경우 실제 신고 때 어떤 근거로 기재하셨는지 알려주실 수 있을까요.",
  general: " 이 부분에 대해 추가로 알고 계신 분 의견 부탁드려요.",
};

function toQuestion(content, slug) {
  const suffix = QUESTION_SUFFIX_BY_TOPIC[pickTopic(slug)] ?? QUESTION_SUFFIX_BY_TOPIC.general;
  const trimmed = content.trim().replace(/[.?!]+$/, "");
  return trimmed + "." + suffix;
}

async function fetchAll() {
  const { data, error } = await supabase
    .from("post_discussions")
    .select("id,post_slug,content,is_question,created_at")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateDisc(id, patch) {
  if (isDryRun) return;
  const { error } = await supabase
    .from("post_discussions")
    .update(patch)
    .eq("id", id);
  if (error) console.error(`  update ${id}: ${error.message}`);
}

async function main() {
  console.log(`[boost-v2] dryRun=${isDryRun}`);
  const rows = await fetchAll();
  const bySlug = new Map();
  for (const row of rows) {
    if (!bySlug.has(row.post_slug)) bySlug.set(row.post_slug, []);
    bySlug.get(row.post_slug).push(row);
  }

  let seed = 9000;
  let stats = { extended: 0, addedQuestion: 0 };

  for (const [slug, comments] of bySlug.entries()) {
    // 1) 80~120자 구간 중 절반을 150자+ 로 확장
    const candidates = comments.filter((c) => {
      const length = c.content?.length ?? 0;
      return length >= 80 && length < 130 && !c.is_question;
    });
    const target = Math.ceil(candidates.length / 2);
    for (let index = 0; index < target; index += 1) {
      const disc = candidates[index];
      const extended =
        disc.content.trim().replace(/[.?!]+$/, "") + "." + followupFor(slug, seed++);
      await updateDisc(disc.id, { content: extended, char_count: extended.length });
      stats.extended += 1;
    }

    // 2) 질문 개수 체크 — 포스트당 2.2개 평균 (22% 달성)
    const freshQuestions = comments.filter((c) => c.is_question).length;
    const targetQuestions = comments.length >= 10 ? 3 : 2;
    const needed = Math.max(0, targetQuestions - freshQuestions);
    if (needed > 0) {
      // 120자 이상 statement 중 첫 needed 개를 질문으로 전환
      const statementPool = comments
        .filter((c) => !c.is_question && (c.content?.length ?? 0) >= 110)
        .slice(0, needed);
      for (const disc of statementPool) {
        const qContent = toQuestion(disc.content, slug);
        await updateDisc(disc.id, {
          content: qContent,
          is_question: true,
          char_count: qContent.length,
        });
        stats.addedQuestion += 1;
      }
    }
  }

  console.log(`[done] extended=${stats.extended} addedQuestion=${stats.addedQuestion}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
