/**
 * Phase 9.0 소통 커뮤니티 게시판 타입 정의
 * community_posts / community_comments 테이블과 1:1 매핑
 */

export const COMMUNITY_CATEGORIES = [
  { slug: "all", name: "전체", path: "/community" },
  { slug: "free", name: "자유토크", path: "/community?cat=free" },
  { slug: "qna", name: "질문/답변", path: "/community?cat=qna" },
  { slug: "review", name: "후기/리뷰", path: "/community?cat=review" },
  { slug: "info", name: "정보공유", path: "/community?cat=info" },
  { slug: "humor", name: "유머/짤", path: "/community?cat=humor" },
] as const;

export type CommunityCategorySlug =
  (typeof COMMUNITY_CATEGORIES)[number]["slug"];

export const WRITABLE_CATEGORIES: ReadonlyArray<CommunityCategorySlug> = [
  "free",
  "qna",
  "review",
  "info",
  "humor",
];

export type CommunitySortKey = "recent" | "popular" | "comments";

export interface CommunityPostRow {
  id: string;
  category: CommunityCategorySlug;
  title: string;
  content: string;
  nickname: string;
  password_hash: string;
  view_count: number;
  comment_count: number;
  is_hot: boolean;
  is_ai_generated: boolean;
  persona_id: string | null;
  ip_hash: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityCommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  nickname: string;
  password_hash: string;
  content: string;
  is_ai_generated: boolean;
  persona_id: string | null;
  ip_hash: string | null;
  created_at: string;
}

/** 목록/상세에 노출할 때 비밀번호 해시 등은 절대 포함하지 않는다 */
export type CommunityPostPublic = Omit<
  CommunityPostRow,
  "password_hash" | "ip_hash"
>;

export type CommunityCommentPublic = Omit<
  CommunityCommentRow,
  "password_hash" | "ip_hash"
>;

export interface CommunityCommentThread extends CommunityCommentPublic {
  replies: CommunityCommentPublic[];
}

export interface InsertCommunityPostParams {
  category: CommunityCategorySlug;
  title: string;
  content: string;
  nickname: string;
  password_hash: string;
  ip_hash: string | null;
  image_url?: string | null;
  is_ai_generated?: boolean;
  persona_id?: string | null;
  created_at?: string;
}

export interface InsertCommunityCommentParams {
  post_id: string;
  parent_id: string | null;
  nickname: string;
  password_hash: string;
  content: string;
  ip_hash: string | null;
  is_ai_generated?: boolean;
  persona_id?: string | null;
  created_at?: string;
}

export interface CommunityListFilter {
  category?: CommunityCategorySlug;
  sort?: CommunitySortKey;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CommunityListResult {
  posts: CommunityPostPublic[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CommunityPostDetail {
  post: CommunityPostPublic;
  comments: CommunityCommentThread[];
}
