import { NextRequest, NextResponse } from "next/server";
import { runAllHealthChecks, type HealthCheck } from "@/lib/seo-health";
import { sendNewsletter } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runHealthCron();
}

export async function POST(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runHealthCron();
}

function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron:seo-health] CRON_SECRET 미설정");
    return NextResponse.json({ error: "server-not-configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function runHealthCron(): Promise<NextResponse> {
  const checks = await runAllHealthChecks();
  const alerts = checks.filter((check) => check.severity !== "ok");
  if (alerts.length === 0) {
    return NextResponse.json({ ok: true, alerts: 0, checks });
  }
  const dispatched = await tryDispatchAlerts(alerts);
  return NextResponse.json({ ok: true, alerts: alerts.length, dispatched, checks });
}

async function tryDispatchAlerts(alerts: HealthCheck[]): Promise<boolean> {
  const recipients = (process.env.SEO_HEALTH_ALERT_TO ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (recipients.length === 0) return false;
  try {
    await sendNewsletter({
      to: recipients,
      subject: `[아이숨 SEO Health] ${alerts.length}개 항목 이상 감지`,
      html: renderHtml(alerts),
    });
    return true;
  } catch (error) {
    console.error("[cron:seo-health] email dispatch failed:", error);
    return false;
  }
}

function renderHtml(alerts: HealthCheck[]): string {
  const rows = alerts
    .map(
      (alert) =>
        `<tr><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.label)}</td><td style="padding:8px;border:1px solid #eee;">${alert.value} ${escapeHtml(alert.unit)}</td><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.severity)}</td><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.detail)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="font-family:sans-serif;color:#1c1917;"><h1 style="font-size:18px;">SEO Health 경고</h1><p style="font-size:13px;">다음 지표가 임계값을 초과했습니다. /admin/seo-health 에서 상세를 확인하세요.</p><table style="border-collapse:collapse;width:100%;font-size:13px;"><thead><tr><th style="padding:8px;border:1px solid #eee;text-align:left;">지표</th><th style="padding:8px;border:1px solid #eee;text-align:left;">값</th><th style="padding:8px;border:1px solid #eee;text-align:left;">등급</th><th style="padding:8px;border:1px solid #eee;text-align:left;">상세</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
