#!/usr/bin/env node
/**
 * Phase 9.2 — 기존 community_posts 의 댓글 수 부족분 보강
 *
 * 현재 평균 4.96 / 포스트 → 목표 6~7 개
 * 포스트별 댓글 < 6 개인 경우 부족분만 추가.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
  pickReplyTimestamp,
} from "./lib/anti-bot-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes("--dry");

const EXTRA_COMMENTS_BY_CATEGORY = {
  free: [
    "저도 비슷한 경험 있어서 댓글 남깁니다 제 경우엔 결국 작은 루틴 하나 추가한 게 제일 효과적이었어요",
    "이 글 보니까 저도 오늘 저녁엔 외출 한번 해봐야겠네요 최근에 너무 집에만 있었던 것 같습니다",
    "공감되는 얘기 많네요 저는 비슷한 상황에서 친구랑 같이 시작했더니 훨씬 오래 유지됐어요",
    "저도 오래 고민하던 주제인데 의견 주신 분들 덕분에 방향이 잡힙니다 감사합니다",
  ],
  qna: [
    "저도 같은 질문 올리려던 참이었어요 답변 주시는 분들 계시면 같이 참고하겠습니다",
    "비슷한 상황 겪어봤는데 저는 결국 전문가 상담이 가장 빠른 길이었어요 시간이 돈입니다",
    "제 경우엔 처음에 혼자 알아보다가 포기하고 커뮤니티 오니까 더 빨리 해결됐습니다",
    "저도 이 부분 궁금해서 구독합니다 답변 주시는 분들 실제 경험 기반이면 좋겠어요",
  ],
  review: [
    "후기 감사합니다 저도 구매 고민 중이었는데 이 글 덕분에 마음 정했어요",
    "저는 3개월 째 쓰고 있는데 초반엔 헤맸지만 지금은 익숙해졌어요 후기 공감합니다",
    "단점 부분 특히 공감됩니다 저도 같은 이유로 갈아탈까 고민 중이에요",
    "실 사용 후기 너무 도움됐어요 다른 제품이랑 비교 글도 있으면 좋을 것 같아요",
  ],
  info: [
    "정보 공유 감사드려요 저도 이거 찾느라 몇 시간 썼는데 한 번에 정리돼서 너무 좋습니다",
    "저장해두고 필요할 때마다 참고할게요 이런 정리 글이 진짜 값집니다",
    "저도 이 내용 몰라서 작년에 손해 본 적 있는데 올해부터는 이 글 참고해서 대비할 수 있겠네요",
    "지역별 차이 부분 추가로 올려주시면 더 유용할 것 같아요 지방은 기준이 조금씩 달라서요",
  ],
  humor: [
    "ㅋㅋㅋ 진짜 공감 저도 똑같은 경험 있습니다",
    "아 이거 너무 웃기네요 출근길에 읽다가 혼자 빵 터짐",
    "저희 집 댕이도 똑같아요 주인 취급 안 해주는 거 ㅠㅠ",
    "ㅋㅋㅋㅋ 진짜 공감되는 사연이네요 저도 저장합니다",
  ],
};

async function main() {
  console.log(`[boost-comments] dryRun=${isDryRun}`);

  const { data: personas } = await supabase
    .from("discussion_personas")
    .select("id,nickname")
    .eq("active", true);
  if (!personas || personas.length === 0) {
    console.error("페르소나 없음");
    process.exit(1);
  }

  const { data: posts } = await supabase
    .from("community_posts")
    .select("id,category,created_at,comment_count,persona_id");
  if (!posts) return;

  let seed = 15000;
  let stats = { added: 0, posts: 0 };
  const TARGET_COMMENTS = 6;

  for (const post of posts) {
    const current = post.comment_count ?? 0;
    const need = Math.max(0, TARGET_COMMENTS - current);
    if (need === 0) continue;

    const pool = EXTRA_COMMENTS_BY_CATEGORY[post.category] ?? EXTRA_COMMENTS_BY_CATEGORY.free;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, need);

    const postDate = new Date(post.created_at);
    const timestamps = distributeCommentTimestamps(postDate, need, {
      maxDays: 7,
      peakBiasDays: 1.5,
    });

    for (let index = 0; index < shuffled.length; index += 1) {
      const author = personas.filter((p) => p.id !== post.persona_id)[
        Math.floor(Math.random() * (personas.length - 1))
      ];
      const content = shuffled[index];
      const ipHash = generateFakeIpHash(seed++);
      if (!isDryRun) {
        const { error } = await supabase.from("community_comments").insert({
          post_id: post.id,
          parent_id: null,
          nickname: author.nickname,
          password_hash: crypto.createHash("sha256").update("boost-" + seed).digest("hex"),
          content,
          is_ai_generated: true,
          persona_id: author.id,
          ip_hash: ipHash,
          created_at: timestamps[index].toISOString(),
        });
        if (error) console.error("  insert:", error.message);
      }
      stats.added += 1;
    }
    stats.posts += 1;
  }

  console.log(`[done] postsTouched=${stats.posts} commentsAdded=${stats.added}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
