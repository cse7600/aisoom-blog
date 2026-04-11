#!/usr/bin/env node
/**
 * 지속적 콘텐츠 파이프라인 단일 진입점.
 *
 * 하나의 포스트를 D+0 → D+2 → D+7 → D+30 단계별로 관리한다.
 *   D+0: publish + 댓글 5개 + 커뮤니티 질문글 + 댓글 3개
 *   D+2: 댓글 +3 (질문 위주) + 커뮤니티 review 글
 *   D+7: 댓글 +3 (반대/후기) + 커뮤니티 댓글 +3
 *   D+30: 댓글 +2 (한 달 써보니) + is_hot 후보 확인
 *
 * 사용법:
 *   node scripts/content-pipeline.mjs --slug <slug> --phase <d0|d2|d7|d30>
 *   node scripts/content-pipeline.mjs --phase d0 --all      # 예정된 slug 전부
 *   node scripts/content-pipeline.mjs --phase d0 --dry      # DB 미변경
 *
 * 실행 기록은 scripts/content-schedule.json 의 `done` 배열에 누적.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
  pickReplyTimestamp,
  snapToActiveWindow,
  estimateViewCount,
} from "./lib/anti-bot-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEDULE_PATH = path.join(ROOT, "scripts", "content-schedule.json");

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

let personaCache = null;

const PHASE_COMMENT_POOL = {
  d0: [
    "방금 읽었는데 구성이 실무 중심이라 도움 됐습니다. 특히 비용 항목 정리가 현실적이에요.",
    "이런 정리글 정말 드물어서 북마크 해뒀어요. 공유 감사합니다.",
    "평소 궁금했던 부분인데 숫자까지 나와 있어서 바로 써먹을 수 있겠네요.",
    "업종은 다르지만 비슷한 고민 하고 있었는데 방향성 잡는 데 큰 참고가 됐습니다.",
    "기사 끝 체크리스트 캡처해서 동료한테 공유했어요. 깔끔하게 정리돼 있어서 좋았습니다.",
    "처음엔 반신반의였는데 중간 비교표 보고 나니까 명확해지네요. 잘 읽었습니다.",
  ],
  d2: [
    "질문 있습니다. 기사 중간에 나온 조건이 저희 업장처럼 24시간 영업인 경우에도 동일하게 적용될까요?",
    "궁금한 게, 실제 후기 기준으로 반려 사례는 얼마나 되는 편인가요? 통계가 있으면 공유 부탁드려요.",
    "혹시 이 방식 적용할 때 초기 6개월 안에 주의할 포인트가 더 있을까요? 경험담 궁금합니다.",
  ],
  d7: [
    "글 내용은 공감되는데, 저희 매장에서 비슷하게 따라 했을 때는 오히려 비용이 더 나왔어요. 조건에 따라 달라지니 맹신은 금물일 것 같습니다.",
    "일주일 써보고 후기 남깁니다. 결론부터 말하면 나쁘지 않은데, 초반 셋업에서 막히는 구간이 하나 있었어요. 다른 분들도 참고하세요.",
    "반대 의견 하나 드리자면, 이 방식은 매출 규모가 일정 수준 이상일 때만 효율이 나옵니다. 월 매출 2천 이하 매장에는 오히려 부담이에요.",
  ],
  d30: [
    "한 달 써보니까 처음 우려했던 부분은 거의 해결됐어요. 초반 3일이 제일 힘들었고 이후엔 루틴으로 자리 잡았습니다.",
    "30일 지난 시점에서 다시 읽어보니 체크리스트 항목이 다 실전에서 통했네요. 특히 중간 점검 포인트가 유용했어요.",
  ],
};

const COMMUNITY_COMMENT_POOL = [
  "저도 같은 고민 중이었는데 다른 분들 의견 궁금해요",
  "관련 글 본문에 링크 있던데 도움 많이 됐습니다",
  "저는 다른 방식 써봤는데 결과적으로는 비슷했어요",
  "혹시 업종 다른 분들도 비슷한 경험 있으신가요",
  "참고 자료 있으면 하나 더 공유 부탁드려요",
  "해보고 후기 다시 올릴게요",
];

const COMMUNITY_TEMPLATES = {
  qna: {
    title: (postTitle) => `${firstWords(postTitle, 14)} 관련해서 질문 있어요`,
    content: (postTitle, slug) =>
      `마침 이 주제 찾고 있었는데 본문 글(/${slug})이 많이 참고됐습니다.\n\n다만 우리 업장 상황에 바로 대입하려니 막히는 부분이 있어서요. "${firstWords(postTitle, 20)}" 조건에서 실제로 적용해 본 분들 경험 공유 부탁드립니다. 특히 초기 셋업에서 시행착오 겪은 부분 궁금해요.`,
  },
  review: {
    title: (postTitle) => `${firstWords(postTitle, 12)} — 며칠 해본 후기`,
    content: (postTitle, slug) =>
      `며칠 전에 올라온 본문 글(/${slug}) 보고 바로 적용해봤습니다. 결론부터 말하면 체감은 있는데 일부 항목은 글보다 현실이 더 복잡했어요.\n\n잘 맞는 케이스와 아닌 케이스를 정리해서 남기니 비슷한 고민 하시는 분들께 도움이 되길 바랍니다.`,
  },
};

const args = parseArgs(process.argv.slice(2));

if (!args.phase) {
  console.error(
    "Usage: node scripts/content-pipeline.mjs --slug <slug> --phase <d0|d2|d7|d30> [--dry] [--all]",
  );
  process.exit(1);
}

const validPhases = new Set(["d0", "d2", "d7", "d30"]);
if (!validPhases.has(args.phase)) {
  console.error(`잘못된 phase: ${args.phase}. d0|d2|d7|d30 중 하나여야 함.`);
  process.exit(1);
}

await runMain();

// ─── main ────────────────────────────────────────────────────────────────────

/**
 * 입력 옵션에 따라 단일/전체 슬러그 대상 파이프라인을 실행한다.
 */
async function runMain() {
  const schedule = loadSchedule();
  const selected = selectEntries(schedule, args);
  if (selected.length === 0) {
    console.error("대상 slug가 없습니다. --slug 지정 또는 content-schedule.json 확인.");
    process.exit(1);
  }

  for (const entry of selected) {
    console.log(`\n[${args.phase.toUpperCase()}] ${entry.slug}`);
    try {
      await executePhase(entry, args.phase, args.dry);
      markPhaseDone(schedule, entry.slug, args.phase);
    } catch (err) {
      console.error(`  실패: ${err.message}`);
      throw err;
    }
  }

  if (!args.dry) saveSchedule(schedule);
  console.log(`\n완료: ${selected.length}개 slug ${args.phase} 처리.`);
}

/**
 * 단일 slug + 단일 phase 실행.
 * @param {{slug: string, mdPath?: string}} entry
 * @param {string} phase
 * @param {boolean} dry
 */
async function executePhase(entry, phase, dry) {
  if (phase === "d0") {
    await runD0(entry, dry);
  } else if (phase === "d2") {
    await runD2(entry, dry);
  } else if (phase === "d7") {
    await runD7(entry, dry);
  } else if (phase === "d30") {
    await runD30(entry, dry);
  }
}

// ─── phase handlers ──────────────────────────────────────────────────────────

/**
 * D+0: publish → 댓글 5개 → 커뮤니티 qna 글 + 댓글 3개.
 * @param {{slug: string, mdPath?: string}} entry
 * @param {boolean} dry
 */
async function runD0(entry, dry) {
  const post = await ensurePublished(entry, dry);
  if (!post) {
    console.log("  발행 확인 실패 — 스킵");
    return;
  }
  const anchor = anchorFromPublishedAt(post.published_at);
  await injectDiscussionComments(post, anchor, 5, "d0", dry);
  await seedCommunityPost(post, "qna", 3, dry);
}

/**
 * D+2: 질문 위주 댓글 3개 + 커뮤니티 review 글 1개.
 */
async function runD2(entry, dry) {
  const post = await fetchPost(entry.slug);
  if (!post) throw new Error("post 없음 — publish 먼저 실행 필요");
  const anchor = new Date(Date.now() - 6 * 60 * 60 * 1000);
  await injectDiscussionComments(post, anchor, 3, "d2", dry);
  await seedCommunityPost(post, "review", 2, dry);
}

/**
 * D+7: 반대 + 후기 3개 + 커뮤니티 댓글 +3.
 */
async function runD7(entry, dry) {
  const post = await fetchPost(entry.slug);
  if (!post) throw new Error("post 없음");
  const anchor = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await injectDiscussionComments(post, anchor, 3, "d7", dry);
  await appendCommunityComments(post.slug, 3, dry);
}

/**
 * D+30: "한 달 써보니" 댓글 2개 + is_hot 후보 확인.
 */
async function runD30(entry, dry) {
  const post = await fetchPost(entry.slug);
  if (!post) throw new Error("post 없음");
  const anchor = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await injectDiscussionComments(post, anchor, 2, "d30", dry);
  await reportHotCandidate(post, dry);
}

// ─── publish 단계 ────────────────────────────────────────────────────────────

/**
 * posts 테이블에 해당 slug가 있으면 그대로 반환, 없으면 publish-post.mjs 호출.
 * @param {{slug: string, mdPath?: string}} entry
 * @param {boolean} dry
 */
async function ensurePublished(entry, dry) {
  const existing = await fetchPost(entry.slug);
  if (existing) {
    console.log(`  이미 발행됨: id=${existing.id}`);
    return existing;
  }
  if (dry) {
    console.log("  [dry] publish-post.mjs 호출 스킵");
    return null;
  }
  const mdPath = entry.mdPath ?? findMarkdownPath(entry.slug);
  if (!mdPath) throw new Error(`md 파일을 찾을 수 없음: ${entry.slug}`);
  console.log(`  publish-post.mjs ${path.relative(ROOT, mdPath)}`);
  const out = spawnSync("node", ["scripts/publish-post.mjs", mdPath], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (out.status !== 0) throw new Error("publish-post.mjs 실패");
  return await fetchPost(entry.slug);
}

/**
 * posts 테이블에서 slug로 조회. 없으면 null.
 */
async function fetchPost(slug) {
  const { data, error } = await supabase
    .from("posts")
    .select("id,slug,title,category,published_at,created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`posts select: ${error.message}`);
  return data;
}

/**
 * 마크다운 파일 경로 탐색 — 키퍼메이트/법인설립지원센터/밀리의서재/차별화상회 하위.
 */
function findMarkdownPath(slug) {
  const affiliatesPath = path.join(ROOT, "content-input", "affiliates.json");
  const affiliates = JSON.parse(fs.readFileSync(affiliatesPath, "utf-8")).affiliates;
  for (const aff of affiliates) {
    const dir = path.join(ROOT, aff.contentDir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const m = raw.match(/^slug:\s*"?([^"\n]+)"?/m);
      if (m && m[1].trim() === slug) return path.join(dir, file);
    }
  }
  return null;
}

// ─── 댓글 삽입 ───────────────────────────────────────────────────────────────

/**
 * post_discussions 에 phase별 템플릿 댓글을 N개 삽입.
 * 질문/반대/후기 톤은 phase별로 다르다.
 * @param {{id: number, slug: string, category: string}} post
 * @param {Date} anchor
 * @param {number} count
 * @param {"d0"|"d2"|"d7"|"d30"} phase
 * @param {boolean} dry
 */
async function injectDiscussionComments(post, anchor, count, phase, dry) {
  const personas = await loadPersonas();
  if (personas.length === 0) throw new Error("discussion_personas 비어있음");

  const pool = PHASE_COMMENT_POOL[phase];
  const picks = pickN(pool, count);
  const timestamps = distributeCommentTimestamps(anchor, count, {
    maxDays: phaseMaxDays(phase),
    peakBiasDays: 1,
  });

  for (let idx = 0; idx < picks.length; idx += 1) {
    const text = picks[idx];
    const author = pickPersonaByTone(personas, phase);
    const ipHash = generateFakeIpHash(Date.now() + idx);
    const createdAt = timestamps[idx].toISOString();

    if (dry) {
      console.log(`  [dry] ${phase} 댓글: ${text.slice(0, 40)}...`);
      continue;
    }
    const { error } = await supabase.from("post_discussions").insert({
      post_slug: post.slug,
      persona_id: author.id,
      content: text,
      sentiment: phaseSentiment(phase),
      is_question: phase === "d2",
      upvotes: Math.floor(Math.random() * 6),
      published: true,
      generation_batch: `pipeline_${phase}`,
      thread_template: phaseTemplate(phase),
      generation_phase: "bootstrap",
      quality_tier: "normal",
      char_count: text.length,
      ip_hash: ipHash,
      created_at: createdAt,
    });
    if (error) {
      console.error(`  댓글 삽입 실패: ${error.message}`);
      continue;
    }
  }
  console.log(`  post_discussions +${count} (${phase})`);
}

// ─── 커뮤니티 시드 ───────────────────────────────────────────────────────────

/**
 * 포스트 주제 기반 community_posts 글 1개 + 댓글 N개 생성.
 * @param {{slug: string, title: string, category: string}} post
 * @param {"qna"|"review"} communityCategory
 * @param {number} commentCount
 * @param {boolean} dry
 */
async function seedCommunityPost(post, communityCategory, commentCount, dry) {
  const personas = await loadPersonas();
  const author = pickPersonaByTone(personas, "d0");
  const template = COMMUNITY_TEMPLATES[communityCategory];
  const title = template.title(post.title);
  const content = template.content(post.title, post.slug);

  if (dry) {
    console.log(`  [dry] community ${communityCategory}: ${title}`);
    return;
  }
  const createdAt = snapToActiveWindow(new Date(Date.now() - 3 * 60 * 60 * 1000));
  const ipHash = generateFakeIpHash(Date.now());
  const viewCount = estimateViewCount(createdAt, { baseDaily: 2.5, decayHalfLife: 5 });

  const { data: inserted, error } = await supabase
    .from("community_posts")
    .insert({
      category: communityCategory,
      title,
      content,
      nickname: author.nickname,
      password_hash: seedHash(`pipe-${post.slug}`),
      view_count: viewCount,
      is_ai_generated: true,
      persona_id: author.id,
      ip_hash: ipHash,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error(`  community_posts insert 실패: ${error.message}`);
    return;
  }
  console.log(`  community_posts id=${inserted.id} category=${communityCategory}`);
  await appendCommentsToCommunityPost(inserted.id, createdAt, commentCount, personas, false);
}

/**
 * 기존 community_posts 중 post.slug 관련 글에 댓글 N개 추가.
 * @param {string} slug
 * @param {number} count
 * @param {boolean} dry
 */
async function appendCommunityComments(slug, count, dry) {
  const { data: rows, error } = await supabase
    .from("community_posts")
    .select("id,created_at")
    .ilike("title", `%${firstKeyword(slug)}%`)
    .limit(3);
  if (error) {
    console.error(`  community_posts 조회 실패: ${error.message}`);
    return;
  }
  if (!rows || rows.length === 0) {
    console.log("  관련 community_posts 없음 — 스킵");
    return;
  }
  const personas = await loadPersonas();
  for (const row of rows) {
    if (dry) {
      console.log(`  [dry] community_comments +${count} to post ${row.id}`);
      continue;
    }
    await appendCommentsToCommunityPost(row.id, new Date(row.created_at), count, personas, false);
  }
}

/**
 * community_comments 에 N개 삽입. 재사용 유틸.
 * @param {string|number} postId
 * @param {Date} anchor
 * @param {number} count
 * @param {Array<{id:string,nickname:string}>} personas
 * @param {boolean} dry
 */
async function appendCommentsToCommunityPost(postId, anchor, count, personas, dry) {
  const pool = COMMUNITY_COMMENT_POOL;
  const picks = pickN(pool, count);
  const times = distributeCommentTimestamps(anchor, count, { maxDays: 2, peakBiasDays: 0.5 });

  for (let idx = 0; idx < picks.length; idx += 1) {
    const commenter = personas[Math.floor(Math.random() * personas.length)];
    const ipHash = generateFakeIpHash(Date.now() + idx + 333);
    if (dry) continue;
    const { error } = await supabase.from("community_comments").insert({
      post_id: postId,
      parent_id: null,
      nickname: commenter.nickname,
      password_hash: seedHash(`pipe-c-${postId}-${idx}`),
      content: picks[idx],
      is_ai_generated: true,
      persona_id: commenter.id,
      ip_hash: ipHash,
      created_at: times[idx].toISOString(),
    });
    if (error) console.error(`    community_comments 실패: ${error.message}`);
  }
  console.log(`  community_comments +${count} (post ${postId})`);
}

/**
 * D+30 시점에서 post_discussions 수·조회수를 출력해 is_hot 후보 여부 안내.
 */
async function reportHotCandidate(post, dry) {
  if (dry) {
    console.log("  [dry] hot 후보 리포트 스킵");
    return;
  }
  const { count: discCount } = await supabase
    .from("post_discussions")
    .select("*", { count: "exact", head: true })
    .eq("post_slug", post.slug);
  console.log(
    `  hot 후보: discussions=${discCount ?? 0} (>=8 권장) title="${post.title.slice(0, 30)}"`,
  );
}

// ─── 페르소나 & 풀 ───────────────────────────────────────────────────────────

/**
 * discussion_personas 활성 목록을 캐시하여 반환.
 */
async function loadPersonas() {
  if (personaCache) return personaCache;
  const { data, error } = await supabase
    .from("discussion_personas")
    .select("id,nickname,persona_type")
    .eq("active", true);
  if (error) throw new Error(`personas: ${error.message}`);
  personaCache = data ?? [];
  return personaCache;
}

/**
 * phase별 톤에 맞는 페르소나 우선 선택.
 */
function pickPersonaByTone(personas, phase) {
  const prefs = {
    d0: ["normal", "chatty"],
    d2: ["normal", "expert"],
    d7: ["expert", "normal"],
    d30: ["normal"],
  }[phase] ?? ["normal"];
  const filtered = personas.filter((entry) => prefs.includes(entry.persona_type));
  const pool = filtered.length > 0 ? filtered : personas;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 풀에서 N개 비복원 무작위 추출. pool 길이 < count 면 중복 허용으로 보충.
 */
function pickN(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  if (shuffled.length >= count) return shuffled.slice(0, count);
  const extras = [];
  for (let idx = 0; idx < count - shuffled.length; idx += 1) {
    extras.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return [...shuffled, ...extras];
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/**
 * 포스트 제목의 앞 N글자를 추출. 공백 경계에서 자르고 말줄임표는 넣지 않는다.
 */
function firstWords(text, maxLen) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 4 ? cut.slice(0, lastSpace) : cut;
}

/**
 * slug 첫 번째 토큰 추출 (커뮤니티 글 매칭용).
 */
function firstKeyword(slug) {
  return slug.split("-").filter(Boolean)[0] ?? slug;
}

/**
 * post.published_at 을 Date 로 변환, 없으면 현재 시각 사용.
 */
function anchorFromPublishedAt(publishedAt) {
  if (!publishedAt) return new Date();
  const base = new Date(publishedAt);
  base.setTime(base.getTime() + 45 * 60 * 1000);
  return base;
}

/**
 * phase 별 댓글 스프레드 일수.
 */
function phaseMaxDays(phase) {
  return { d0: 1.5, d2: 1, d7: 1, d30: 0.5 }[phase] ?? 1;
}

function phaseSentiment(phase) {
  return { d0: "positive", d2: "neutral", d7: "mixed", d30: "positive" }[phase] ?? "neutral";
}

function phaseTemplate(phase) {
  return {
    d0: "d0_first_impression",
    d2: "d2_question_focus",
    d7: "d7_counter_and_review",
    d30: "d30_month_later",
  }[phase] ?? "unknown";
}

function seedHash(input) {
  return crypto
    .createHash("sha256")
    .update(`${input}-${Date.now()}-${Math.random()}`)
    .digest("hex");
}

// ─── 스케줄 I/O ──────────────────────────────────────────────────────────────

/**
 * scripts/content-schedule.json 로드. 없으면 빈 스케줄 반환.
 */
function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    return { schedule: [] };
  }
  return JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf-8"));
}

function saveSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2));
}

/**
 * CLI 옵션에 따라 대상 엔트리 결정.
 * --slug 지정 시 단일 엔트리 (스케줄에 없어도 즉석 구성).
 * --all 시 phase 가 done 배열에 없는 모든 엔트리.
 */
function selectEntries(schedule, opts) {
  if (opts.slug) {
    const found = schedule.schedule.find((row) => row.slug === opts.slug);
    if (found) return [found];
    return [{ slug: opts.slug, done: [] }];
  }
  if (opts.all) {
    return schedule.schedule.filter((row) => !(row.done ?? []).includes(opts.phase));
  }
  return [];
}

function markPhaseDone(schedule, slug, phase) {
  let entry = schedule.schedule.find((row) => row.slug === slug);
  if (!entry) {
    entry = { slug, done: [] };
    schedule.schedule.push(entry);
  }
  entry.done ??= [];
  if (!entry.done.includes(phase)) entry.done.push(phase);
  entry.lastRunAt = new Date().toISOString();
}

// ─── CLI 파서 & env 로더 ─────────────────────────────────────────────────────

function parseArgs(list) {
  const out = { dry: false, all: false };
  for (let idx = 0; idx < list.length; idx += 1) {
    const token = list[idx];
    if (token === "--dry") out.dry = true;
    else if (token === "--all") out.all = true;
    else if (token === "--slug") out.slug = list[++idx];
    else if (token === "--phase") out.phase = list[++idx];
  }
  return out;
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
