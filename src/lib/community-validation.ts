/**
 * Phase 9.0 커뮤니티 입력 검증
 * 모든 사용자 입력은 API 레벨에서 이 파일을 거친다
 */

import type { CommunityCategorySlug } from "./community-types";
import { WRITABLE_CATEGORIES } from "./community-types";

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 10;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 40;
const TITLE_MIN = 5;
const TITLE_MAX = 100;
const CONTENT_MIN = 10;
const CONTENT_MAX = 10000;
const COMMENT_MIN = 2;
const COMMENT_MAX = 1000;

export interface ValidPostInput {
  category: CommunityCategorySlug;
  title: string;
  content: string;
  nickname: string;
  password: string;
  image_url: string | null;
}

export interface ValidCommentInput {
  nickname: string;
  password: string;
  content: string;
  parent_id: string | null;
}

export function validatePostInput(raw: unknown): ValidPostInput {
  const value = raw as Record<string, unknown>;
  const category = validateCategory(value.category);
  const title = validateString(value.title, "제목", TITLE_MIN, TITLE_MAX);
  const content = validateString(value.content, "내용", CONTENT_MIN, CONTENT_MAX);
  const nickname = validateString(
    value.nickname,
    "닉네임",
    NICKNAME_MIN,
    NICKNAME_MAX
  );
  const password = validateString(
    value.password,
    "비밀번호",
    PASSWORD_MIN,
    PASSWORD_MAX
  );
  const image_url = validateOptionalUrl(value.image_url);

  return { category, title, content, nickname, password, image_url };
}

export function validateCommentInput(raw: unknown): ValidCommentInput {
  const value = raw as Record<string, unknown>;
  const nickname = validateString(
    value.nickname,
    "닉네임",
    NICKNAME_MIN,
    NICKNAME_MAX
  );
  const password = validateString(
    value.password,
    "비밀번호",
    PASSWORD_MIN,
    PASSWORD_MAX
  );
  const content = validateString(
    value.content,
    "댓글",
    COMMENT_MIN,
    COMMENT_MAX
  );
  const parent_id =
    typeof value.parent_id === "string" && value.parent_id.length > 0
      ? value.parent_id
      : null;

  return { nickname, password, content, parent_id };
}

export function validatePasswordOnly(raw: unknown): string {
  const value = raw as { password?: unknown };
  return validateString(value.password, "비밀번호", PASSWORD_MIN, PASSWORD_MAX);
}

function validateCategory(raw: unknown): CommunityCategorySlug {
  if (typeof raw !== "string") {
    throw new ValidationError("카테고리가 필요합니다");
  }
  const found = WRITABLE_CATEGORIES.find((slug) => slug === raw);
  if (!found) {
    throw new ValidationError("허용되지 않은 카테고리입니다");
  }
  return found;
}

function validateString(
  raw: unknown,
  label: string,
  min: number,
  max: number
): string {
  if (typeof raw !== "string") {
    throw new ValidationError(`${label}이(가) 올바르지 않습니다`);
  }
  const trimmed = raw.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${label}은(는) ${min}자 이상이어야 합니다`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${label}은(는) ${max}자 이하로 작성해 주세요`);
  }
  return trimmed;
}

function validateOptionalUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
