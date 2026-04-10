/**
 * Phase 9.0 커뮤니티 AI 시딩
 * Phase 8.5 페르소나를 재사용해 Gemini로 씨앗 게시글 + 댓글을 생성한다.
 */

import { generateText } from "./gemini";
import { getPersonas } from "./discussion-db";
import {
  insertCommunityPost,
  insertCommunityComment,
} from "./community-db";
import { hashPassword } from "./community-auth";
import type { PersonaRow } from "./discussion-types";
import type { CommunityCategorySlug } from "./community-types";

interface GeneratedSeedPost {
  title: string;
  content: string;
}

interface GeneratedSeedComment {
  content: string;
}

export interface CategoryPrompt {
  category: CommunityCategorySlug;
  label: string;
  topics: string[];
}

export const SEED_CATEGORY_PROMPTS: CategoryPrompt[] = [
  {
    category: "free",
    label: "자유토크",
    topics: [
      "요즘 주말마다 뭐 하고 지내는지",
      "출퇴근길 지친 날 소소한 힐링법",
      "최근 꽂힌 취미 공유",
      "직장 동료 때문에 답답했던 에피소드",
    ],
  },
  {
    category: "qna",
    label: "질문/답변",
    topics: [
      "5년 된 노트북 교체할지 그냥 쓸지 고민",
      "월 20만원대 적금 추천 받고 싶어요",
      "이사 갈 때 포장이사 vs 반포장 뭐가 나은가요",
      "부모님 건강식품 선물 뭐가 좋을까요",
    ],
  },
  {
    category: "review",
    label: "후기/리뷰",
    topics: [
      "최근 구매한 가전 솔직 후기",
      "3개월 써본 러닝화 장단점 정리",
      "요즘 구독 중인 OTT 비교 사용기",
      "다이소 득템 리스트 공유",
    ],
  },
  {
    category: "info",
    label: "정보공유",
    topics: [
      "카드 실적 덜 채워도 혜택 챙기는 꿀팁",
      "요즘 앱테크 이거 저거 해본 총평",
      "주말 가볼 만한 근교 나들이 코스",
      "사는 동네 맛집 진짜 찐으로 공유",
    ],
  },
  {
    category: "humor",
    label: "유머/짤",
    topics: [
      "출근길에 있었던 어이없는 사건",
      "우리집 고양이 주인 알기 테스트",
      "어제 친구가 한 말 때문에 빵 터진 썰",
      "편의점 신상 먹방 후기 (엉망진창 버전)",
    ],
  },
];

// ─── 프롬프트 빌더 ────────────────────────────────────────────────────────

function buildPersonaBlock(persona: PersonaRow): string {
  return [
    `- 닉네임: ${persona.nickname}`,
    `- 나이대/직업: ${persona.age_group} / ${persona.occupation ?? "일반"}`,
    `- 관심사: ${persona.interests.join(", ")}`,
    `- 말투 특징: ${persona.tone_keywords.join(", ")}`,
    `- 자주 쓰는 표현: ${persona.sample_phrases.join(" / ")}`,
    `- 이모지 사용: ${persona.emoji_level} / 오타 빈도: ${persona.typo_rate}`,
  ].join("\n");
}

const POST_RULES = [
  "## 절대 규칙",
  "- 실제 한국 커뮤니티(클리앙/뽐뿌/디시) 말투",
  "- 광고/홍보/마케팅 어투 금지",
  '- "추천합니다", "강추", "꼭 해보세요" 같은 표현 금지',
  "- 제목은 10~40자, 흥미를 끌되 과장 금지",
  "- 본문은 200~600자, 문단 2~4개",
  "- 이모지는 페르소나 성향에 맞게 적당히",
  "- 개인정보(전화/이메일) 절대 포함 금지",
].join("\n");

export function buildSeedPostPrompt(
  persona: PersonaRow,
  categoryLabel: string,
  topic: string
): string {
  return [
    "당신은 한국 인터넷 커뮤니티 사용자입니다.",
    `카테고리 "${categoryLabel}" 게시판에 올릴 글을 작성하세요.`,
    "",
    POST_RULES,
    "",
    "## 페르소나",
    buildPersonaBlock(persona),
    "",
    `## 주제 힌트\n${topic}`,
    "",
    "## 출력 형식 (JSON only, 다른 설명 금지)",
    '{"title":"제목","content":"본문 내용"}',
  ].join("\n");
}

const COMMENT_RULES = [
  "## 절대 규칙",
  "- 실제 커뮤니티 말투, 광고/홍보 금지",
  "- 80자~200자",
  "- 원 글에 자연스럽게 반응 (공감/질문/보충/경험)",
  "- 개인정보 금지",
].join("\n");

export function buildSeedCommentPrompt(
  persona: PersonaRow,
  post: { title: string; content: string }
): string {
  return [
    "당신은 한국 인터넷 커뮤니티 사용자입니다.",
    "아래 게시글에 자연스러운 댓글을 남기세요.",
    "",
    COMMENT_RULES,
    "",
    "## 페르소나",
    buildPersonaBlock(persona),
    "",
    `## 게시글\n- 제목: ${post.title}\n- 본문: ${post.content.slice(0, 400)}`,
    "",
    "## 출력 형식 (JSON only)",
    '{"content":"댓글 내용"}',
  ].join("\n");
}

// ─── 파싱 ─────────────────────────────────────────────────────────────────

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseSeedPost(raw: string): GeneratedSeedPost | null {
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (typeof parsed.title !== "string" || typeof parsed.content !== "string") {
    return null;
  }
  const title = parsed.title.trim();
  const content = parsed.content.trim();
  if (title.length < 5 || content.length < 40) return null;
  return { title, content };
}

function parseSeedComment(raw: string): GeneratedSeedComment | null {
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (typeof parsed.content !== "string") return null;
  const content = parsed.content.trim();
  if (content.length < 10) return null;
  return { content };
}

// ─── 생성 ─────────────────────────────────────────────────────────────────

const MAX_RETRY = 3;
const SEED_PASSWORD = process.env.COMMUNITY_SEED_PASSWORD ?? "seed-only-ai-generated";

async function generateSeedPostWithRetry(
  persona: PersonaRow,
  category: CategoryPrompt,
  topic: string
): Promise<GeneratedSeedPost | null> {
  const prompt = buildSeedPostPrompt(persona, category.label, topic);
  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const raw = await generateText(prompt, {
      temperature: 0.95,
      maxOutputTokens: 768,
      responseMimeType: "application/json",
    });
    if (!raw) continue;
    const parsed = parseSeedPost(raw);
    if (parsed) return parsed;
  }
  return null;
}

async function generateSeedCommentWithRetry(
  persona: PersonaRow,
  post: GeneratedSeedPost
): Promise<GeneratedSeedComment | null> {
  const prompt = buildSeedCommentPrompt(persona, post);
  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const raw = await generateText(prompt, {
      temperature: 0.9,
      maxOutputTokens: 400,
      responseMimeType: "application/json",
    });
    if (!raw) continue;
    const parsed = parseSeedComment(raw);
    if (parsed) return parsed;
  }
  return null;
}

// ─── 오케스트레이션 ──────────────────────────────────────────────────────

export interface SeedRunOptions {
  postsPerCategory?: number;
  commentsPerPost?: number;
  dryRun?: boolean;
  categories?: CommunityCategorySlug[];
}

export interface SeedRunOutcome {
  postsCreated: number;
  commentsCreated: number;
  errors: string[];
}

export async function runCommunitySeed(
  options: SeedRunOptions = {}
): Promise<SeedRunOutcome> {
  const postsPerCategory = options.postsPerCategory ?? 3;
  const commentsPerPost = options.commentsPerPost ?? 3;
  const dryRun = Boolean(options.dryRun);

  const personas = await getPersonas(true);
  if (personas.length === 0) {
    return {
      postsCreated: 0,
      commentsCreated: 0,
      errors: ["no-personas-available"],
    };
  }

  const errors: string[] = [];
  let postsCreated = 0;
  let commentsCreated = 0;

  const targets = filterCategories(SEED_CATEGORY_PROMPTS, options.categories);
  const passwordHash = dryRun ? "dry-run" : hashPassword(SEED_PASSWORD);

  for (const category of targets) {
    for (let index = 0; index < postsPerCategory; index += 1) {
      const topic = pickTopic(category, index);
      const author = pickRandom(personas);
      const generated = await generateSeedPostWithRetry(author, category, topic);
      if (!generated) {
        errors.push(`post-failed:${category.category}:${index}`);
        continue;
      }

      if (dryRun) {
        process.stdout.write(
          `[dry-run] ${category.label}/${author.nickname} → ${generated.title}\n`
        );
        postsCreated += 1;
        continue;
      }

      const inserted = await insertCommunityPost({
        category: category.category,
        title: generated.title,
        content: generated.content,
        nickname: author.nickname,
        password_hash: passwordHash,
        ip_hash: null,
        is_ai_generated: true,
        persona_id: author.id,
      });
      if (!inserted) {
        errors.push(`insert-post-failed:${category.category}:${index}`);
        continue;
      }
      postsCreated += 1;

      const commenters = pickCommenters(personas, author.id, commentsPerPost);
      for (const commenter of commenters) {
        const commentGen = await generateSeedCommentWithRetry(commenter, generated);
        if (!commentGen) {
          errors.push(`comment-failed:${inserted.id}:${commenter.nickname}`);
          continue;
        }
        const insertedComment = await insertCommunityComment({
          post_id: inserted.id,
          parent_id: null,
          nickname: commenter.nickname,
          password_hash: passwordHash,
          content: commentGen.content,
          ip_hash: null,
          is_ai_generated: true,
          persona_id: commenter.id,
        });
        if (insertedComment) {
          commentsCreated += 1;
        }
      }
    }
  }

  return { postsCreated, commentsCreated, errors };
}

function filterCategories(
  all: CategoryPrompt[],
  allowed: CommunityCategorySlug[] | undefined
): CategoryPrompt[] {
  if (!allowed || allowed.length === 0) return all;
  const set = new Set(allowed);
  return all.filter((cat) => set.has(cat.category));
}

function pickTopic(category: CategoryPrompt, index: number): string {
  const topics = category.topics;
  if (topics.length === 0) return category.label;
  const fallback = topics[0] ?? category.label;
  return topics[index % topics.length] ?? fallback;
}

function pickRandom<T>(list: T[]): T {
  const first = list[0];
  if (list.length === 0 || first === undefined) {
    throw new Error("pickRandom: empty list");
  }
  const pick = list[Math.floor(Math.random() * list.length)];
  return pick ?? first;
}

function pickCommenters(
  personas: PersonaRow[],
  excludeId: string,
  count: number
): PersonaRow[] {
  const pool = personas.filter((persona) => persona.id !== excludeId);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
