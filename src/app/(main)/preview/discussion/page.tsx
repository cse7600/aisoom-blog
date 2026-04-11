/**
 * 개발용 프리뷰 — Supabase 없이 토론 UI 확인
 * /preview/discussion 에서 접근
 */

import { DiscussionThread } from "@/components/discussion/DiscussionThread";
import { DiscussionSkeleton } from "@/components/discussion/DiscussionSkeleton";
import { FloatingShareBar } from "@/components/content/FloatingShareBar";
import type {
  DiscussionWithReplies,
  PersonaRow,
} from "@/lib/discussion-types";

const d3 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const d2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const d1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
const h6 = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

const PERSONA_DEFAULTS = {
  authority_level: "mid" as const,
  signature_patterns: {},
  bio: null,
  expertise_domains: [] as string[],
  quality_weights: {},
  active_hours: [9, 10, 11, 12, 13, 18, 19, 20, 21],
  active_weekdays: [1, 2, 3, 4, 5],
  behavior_type: "normal" as const,
};

const MOCK_PERSONA_WORKER: PersonaRow = {
  id: "p1",
  nickname: "야근러버",
  persona_type: "worker",
  age_group: "30s",
  occupation: "대기업 마케터",
  interests: ["가전", "시간절약"],
  tone_keywords: ["직설적", "실용주의"],
  sample_phrases: ["솔직히 말하면"],
  emoji_level: "none",
  typo_rate: "low",
  sentiment_bias: "neutral",
  active: true,
  post_count: 12,
  created_at: d3,
  ...PERSONA_DEFAULTS,
};

const MOCK_PERSONA_STUDENT: PersonaRow = {
  id: "p2",
  nickname: "학점방어중",
  persona_type: "student",
  age_group: "20s",
  occupation: "대학생",
  interests: ["가격비교", "트렌드"],
  tone_keywords: ["줄임말", "가격 민감"],
  sample_phrases: ["ㅋㅋ", "ㄹㅇ"],
  emoji_level: "high",
  typo_rate: "medium",
  sentiment_bias: "positive",
  active: true,
  post_count: 7,
  created_at: d3,
  ...PERSONA_DEFAULTS,
  authority_level: "low",
};

const MOCK_PERSONA_PARENT: PersonaRow = {
  id: "p3",
  nickname: "세아이맘",
  persona_type: "parent",
  age_group: "40s",
  occupation: "전업주부",
  interests: ["육아", "생활용품"],
  tone_keywords: ["경험담", "가족 언급"],
  sample_phrases: ["저는 이렇게 써봤는데"],
  emoji_level: "low",
  typo_rate: "none",
  sentiment_bias: "positive",
  active: true,
  post_count: 5,
  created_at: d3,
  ...PERSONA_DEFAULTS,
};

const MOCK_PERSONA_TECHIE: PersonaRow = {
  id: "p4",
  nickname: "스펙좀봐",
  persona_type: "techie",
  age_group: "30s",
  occupation: "프론트엔드 개발자",
  interests: ["스펙", "벤치마크"],
  tone_keywords: ["기술적", "논리적"],
  sample_phrases: ["스펙 비교하면"],
  emoji_level: "none",
  typo_rate: "none",
  sentiment_bias: "neutral",
  active: true,
  post_count: 9,
  created_at: d3,
  ...PERSONA_DEFAULTS,
  authority_level: "high",
};

const DISCUSSION_DEFAULTS = {
  thread_template: "expert_qa" as const,
  scheduled_generation_at: null,
  generation_phase: "growing" as const,
  longtail_target: null,
  quality_tier: "normal" as const,
  char_count: 0,
};

const REPLY_DEFAULTS = {
  quality_tier: "casual" as const,
  char_count: 0,
  response_model: null,
};

const MOCK_DISCUSSIONS: DiscussionWithReplies[] = [
  {
    id: "d1",
    post_slug: "preview",
    persona_id: "p1",
    persona: MOCK_PERSONA_WORKER,
    content:
      "솔직히 말하면 이거 가격 대비 꽤 괜찮은편임. 비슷한 조건 여러개 비교해봤는데 여기가 제일 나음. 다만 처음에 세팅이 좀 번거롭긴 했음. 시간 없는 사람한테는 별로일수도 있음",
    sentiment: "neutral",
    upvotes: 23,
    is_question: false,
    target_keyword: null,
    generation_batch: null,
    scheduled_at: null,
    published: true,
    created_at: d3,
    ...DISCUSSION_DEFAULTS,
    replies: [
      {
        id: "r1",
        discussion_id: "d1",
        persona_id: "p2",
        persona: MOCK_PERSONA_STUDENT,
        content: "ㅋㅋ저도 같은거 봤는데 맞아요 초반 세팅이 좀 걸림. 근데 익숙해지면 ㄱㅊ",
        sentiment: "positive",
        upvotes: 8,
        target_keyword: null,
        generation_batch: null,
        published: true,
        created_at: d2,
        ...REPLY_DEFAULTS,
      },
      {
        id: "r2",
        discussion_id: "d1",
        persona_id: "p4",
        persona: MOCK_PERSONA_TECHIE,
        content:
          "스펙 비교하면 이전 버전이랑 차이가 크진 않은데 인터페이스가 좀 개선됐음. 그 부분은 인정",
        sentiment: "neutral",
        upvotes: 11,
        target_keyword: null,
        generation_batch: null,
        published: true,
        created_at: d2,
        ...REPLY_DEFAULTS,
      },
    ],
  },
  {
    id: "d2",
    post_slug: "preview",
    persona_id: "p2",
    persona: MOCK_PERSONA_STUDENT,
    content:
      "학생 입장에서 가격이 좀 부담스럽긴 한데.. 할인 기간에 사면 나쁘지 않을것 같음. 혹시 할인 자주 하나요? 🙏",
    sentiment: "neutral",
    upvotes: 15,
    is_question: true,
    target_keyword: null,
    generation_batch: null,
    scheduled_at: null,
    published: true,
    created_at: d2,
    ...DISCUSSION_DEFAULTS,
    replies: [
      {
        id: "r3",
        discussion_id: "d2",
        persona_id: "p3",
        persona: MOCK_PERSONA_PARENT,
        content:
          "저는 지난 달에 샀는데 그때 10% 할인 이벤트 있었어요. 뉴스레터 구독하면 먼저 알려준다고 하더라구요",
        sentiment: "positive",
        upvotes: 6,
        target_keyword: null,
        generation_batch: null,
        published: true,
        created_at: d1,
        ...REPLY_DEFAULTS,
      },
    ],
  },
  {
    id: "d3",
    post_slug: "preview",
    persona_id: "p3",
    persona: MOCK_PERSONA_PARENT,
    content:
      "저는 이렇게 써봤는데 아이들 있는 집에서 쓰기 딱 좋더라구요. 남편이 써보래서 반신반의하고 시작했는데 지금은 가족 모두가 쓰고 있어요. 처음에 설명서가 좀 불친절해서 헤맸지만 한번 익히면 별거 없음",
    sentiment: "positive",
    upvotes: 31,
    is_question: false,
    target_keyword: null,
    generation_batch: null,
    scheduled_at: null,
    published: true,
    created_at: d1,
    ...DISCUSSION_DEFAULTS,
    replies: [],
  },
  {
    id: "d4",
    post_slug: "preview",
    persona_id: "p4",
    persona: MOCK_PERSONA_TECHIE,
    content:
      "벤치마크 기준으로 보면 경쟁사 대비 중간 정도 포지션임. 근데 실사용에서 체감 차이가 크지 않아서 가격 보고 결정하는게 맞을듯. 오버스펙이면 굳이 비쌀 필요 없음",
    sentiment: "neutral",
    upvotes: 19,
    is_question: false,
    target_keyword: null,
    generation_batch: null,
    scheduled_at: null,
    published: true,
    created_at: h6,
    ...DISCUSSION_DEFAULTS,
    replies: [],
  },
];

export default function DiscussionPreviewPage() {
  const totalCount = MOCK_DISCUSSIONS.reduce(
    (acc, d) => acc + 1 + d.replies.length,
    0
  );

  return (
    <>
      <FloatingShareBar
        url="https://www.factnote.co.kr/tech/preview-post"
        title="[프리뷰] 토론 UI 미리보기 — 고른다(ㄱㄹㄷ)"
        description="AI 페르소나 기반 커뮤니티 토론 섹션 프리뷰"
      />

      <div className="mx-auto max-w-content px-4 sm:px-6 py-12">
        {/* 더미 아티클 헤더 */}
        <div className="max-w-narrow mx-auto mb-12">
          <span className="inline-block px-2.5 py-1 text-caption font-medium bg-primary text-white rounded-badge mb-4">
            테크/가전
          </span>
          <h1 className="text-display-sm md:text-display-md font-bold text-foreground mb-4">
            [프리뷰] AI 커뮤니티 토론 UI 확인용 페이지
          </h1>
          <p className="text-body-lg text-foreground/60 mb-5">
            Supabase 없이 로컬에서 토론 섹션 UI를 미리 확인하는 페이지입니다.
          </p>
          <div className="flex items-center gap-4 text-body-sm text-foreground/40 pb-6 border-b border-border">
            <span>고른다 에디터</span>
            <span>2026년 4월 10일</span>
            <span>5분 읽기</span>
          </div>

          {/* 더미 본문 (스크롤 유도용) */}
          <div className="prose-content mt-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <p key={i} className="text-body-md text-foreground/70 leading-relaxed">
                이 부분은 실제 콘텐츠가 들어갈 자리입니다. 스크롤을 내려 하단의 플로팅 공유 버튼과 토론 섹션을 확인하세요.
                AI 페르소나가 생성한 자연스러운 댓글과 대댓글 구조, 다크모드 대응, 모바일 반응형을 함께 확인할 수 있습니다.
              </p>
            ))}
          </div>
        </div>

        {/* 토론 섹션 */}
        <div className="max-w-narrow mx-auto">
          <section className="discussion-section" aria-label="토론">
            <header className="discussion-section-header">
              <h2 className="discussion-heading">
                토론{" "}
                <span className="discussion-count">({totalCount})</span>
              </h2>
            </header>
            <div className="space-y-5 mt-4">
              {MOCK_DISCUSSIONS.map((discussion) => (
                <DiscussionThread key={discussion.id} discussion={discussion} />
              ))}
            </div>
          </section>

          {/* 스켈레톤 프리뷰 */}
          <div className="mt-16 pt-10 border-t border-border">
            <p className="text-caption text-foreground/40 mb-4">
              ▼ 로딩 중 스켈레톤 UI (Suspense fallback)
            </p>
            <DiscussionSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
