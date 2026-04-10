/**
 * Phase 8.6 SEO 건강 모니터링 지표 계산
 * /admin/seo-health 와 monitor-seo-health.mjs 에서 공통 사용.
 */

import { createServiceClient } from "./supabase";

export type HealthSeverity = "ok" | "warning" | "critical";

export interface HealthCheck {
  id: string;
  label: string;
  severity: HealthSeverity;
  value: number;
  unit: string;
  threshold: { warning: number; critical: number };
  detail: string;
}

interface DiscussionPickRow {
  id: string;
  persona_id: string;
  thread_template: string;
  char_count: number;
  created_at: string;
}

interface ReplyPickRow {
  id: string;
  persona_id: string;
  char_count: number;
  created_at: string;
}

export async function fetchRecentComments(days: number): Promise<{
  discussions: DiscussionPickRow[];
  replies: ReplyPickRow[];
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const db = createServiceClient();
  const [discussionResult, replyResult] = await Promise.all([
    db
      .from("post_discussions")
      .select("id,persona_id,thread_template,char_count,created_at")
      .gte("created_at", since),
    db
      .from("discussion_replies")
      .select("id,persona_id,char_count,created_at")
      .gte("created_at", since),
  ]);
  if (discussionResult.error) {
    console.error("[seo-health] fetch discussions:", discussionResult.error.message);
  }
  if (replyResult.error) {
    console.error("[seo-health] fetch replies:", replyResult.error.message);
  }
  return {
    discussions: (discussionResult.data ?? []) as DiscussionPickRow[],
    replies: (replyResult.data ?? []) as ReplyPickRow[],
  };
}

export function computeUrlCreationRate(
  discussions: DiscussionPickRow[],
  replies: ReplyPickRow[]
): HealthCheck {
  const totalWeekly = discussions.length + replies.length;
  const severity: HealthSeverity =
    totalWeekly >= 300 ? "critical" : totalWeekly >= 200 ? "warning" : "ok";
  return {
    id: "url_creation_rate",
    label: "주간 URL 생성 속도",
    severity,
    value: totalWeekly,
    unit: "urls/week",
    threshold: { warning: 200, critical: 300 },
    detail: `지난 7일 댓글 ${discussions.length} + 답글 ${replies.length}`,
  };
}

export function computeCommentStddev(
  discussions: DiscussionPickRow[],
  replies: ReplyPickRow[]
): HealthCheck {
  const lengths = [
    ...discussions.map((row) => row.char_count),
    ...replies.map((row) => row.char_count),
  ].filter((length) => length > 0);
  const stddev = standardDeviation(lengths);
  const rounded = Math.round(stddev);
  const severity: HealthSeverity =
    rounded < 80 ? "critical" : rounded < 100 ? "warning" : "ok";
  return {
    id: "comment_stddev",
    label: "댓글 길이 표준편차",
    severity,
    value: rounded,
    unit: "chars",
    threshold: { warning: 100, critical: 80 },
    detail: `샘플 ${lengths.length}개 기준`,
  };
}

export function computePersonaConcentration(
  discussions: DiscussionPickRow[],
  replies: ReplyPickRow[]
): HealthCheck {
  const counts = new Map<string, number>();
  for (const row of discussions) {
    counts.set(row.persona_id, (counts.get(row.persona_id) ?? 0) + 1);
  }
  for (const row of replies) {
    counts.set(row.persona_id, (counts.get(row.persona_id) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return {
      id: "persona_concentration",
      label: "상위 1 페르소나 점유율",
      severity: "ok",
      value: 0,
      unit: "%",
      threshold: { warning: 35, critical: 50 },
      detail: "샘플 없음",
    };
  }
  const topCount = Math.max(...Array.from(counts.values()));
  const share = Math.round((topCount / total) * 100);
  const severity: HealthSeverity =
    share >= 50 ? "critical" : share >= 35 ? "warning" : "ok";
  return {
    id: "persona_concentration",
    label: "상위 1 페르소나 점유율",
    severity,
    value: share,
    unit: "%",
    threshold: { warning: 35, critical: 50 },
    detail: `페르소나 ${counts.size}명 활동`,
  };
}

export function computeTemplateDistribution(
  discussions: DiscussionPickRow[]
): HealthCheck {
  const counts = new Map<string, number>();
  for (const row of discussions) {
    counts.set(row.thread_template, (counts.get(row.thread_template) ?? 0) + 1);
  }
  const total = discussions.length;
  if (total === 0) {
    return {
      id: "template_distribution",
      label: "상위 1 템플릿 점유율",
      severity: "ok",
      value: 0,
      unit: "%",
      threshold: { warning: 50, critical: 70 },
      detail: "샘플 없음",
    };
  }
  const topCount = Math.max(...Array.from(counts.values()));
  const share = Math.round((topCount / total) * 100);
  const severity: HealthSeverity =
    share >= 70 ? "critical" : share >= 50 ? "warning" : "ok";
  return {
    id: "template_distribution",
    label: "상위 1 템플릿 점유율",
    severity,
    value: share,
    unit: "%",
    threshold: { warning: 50, critical: 70 },
    detail: `템플릿 ${counts.size}종 사용`,
  };
}

export async function runAllHealthChecks(): Promise<HealthCheck[]> {
  const data = await fetchRecentComments(7);
  return [
    computeUrlCreationRate(data.discussions, data.replies),
    computeCommentStddev(data.discussions, data.replies),
    computePersonaConcentration(data.discussions, data.replies),
    computeTemplateDistribution(data.discussions),
  ];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
