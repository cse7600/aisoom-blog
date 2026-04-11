#!/usr/bin/env node
/**
 * Phase 8.6 SEO 건강 모니터링 데일리 스크립트
 *
 * Usage:
 *   node scripts/monitor-seo-health.mjs            # 지표 계산 + 경고 시 이메일
 *   node scripts/monitor-seo-health.mjs --dry-run  # 이메일 발송 없이 stdout 출력만
 *
 * Vercel Cron: 0 0 * * * (UTC 자정 = KST 09:00)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnv();

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(args["dry-run"]);
const ALERT_TO = (process.env.SEO_HEALTH_ALERT_TO ?? "").split(",").map((value) => value.trim()).filter(Boolean);

async function main() {
  const { runAllHealthChecks } = await loadModule("src/lib/seo-health.ts");
  const checks = await runAllHealthChecks();
  renderConsole(checks);

  const alerts = checks.filter((check) => check.severity !== "ok");
  if (alerts.length === 0) {
    process.stdout.write("[monitor-seo-health] 모든 지표 정상\n");
    return;
  }
  if (DRY_RUN) {
    process.stdout.write(`[monitor-seo-health] dry-run: ${alerts.length}개 경고 감지 (이메일 미발송)\n`);
    return;
  }
  if (ALERT_TO.length === 0) {
    process.stdout.write("[monitor-seo-health] SEO_HEALTH_ALERT_TO 미설정: 이메일 건너뜀\n");
    return;
  }
  await dispatchAlertEmail(alerts);
}

function renderConsole(checks) {
  for (const check of checks) {
    const marker = severityMarker(check.severity);
    process.stdout.write(
      `${marker} ${check.label.padEnd(20, " ")} ${String(check.value).padStart(6, " ")} ${check.unit}  (${check.detail})\n`
    );
  }
}

function severityMarker(severity) {
  if (severity === "critical") return "[CRIT]";
  if (severity === "warning") return "[WARN]";
  return "[ OK ]";
}

async function dispatchAlertEmail(alerts) {
  const { sendNewsletter } = await loadModule("src/lib/email.ts");
  const subject = `[GRD SEO Health] ${alerts.length}개 항목 이상 감지`;
  const html = renderAlertHtml(alerts);
  await sendNewsletter({ to: ALERT_TO, subject, html });
  process.stdout.write(`[monitor-seo-health] 경고 이메일 발송 완료 -> ${ALERT_TO.join(", ")}\n`);
}

function renderAlertHtml(alerts) {
  const rows = alerts
    .map(
      (alert) =>
        `<tr><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.label)}</td><td style="padding:8px;border:1px solid #eee;">${alert.value} ${escapeHtml(alert.unit)}</td><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.severity)}</td><td style="padding:8px;border:1px solid #eee;">${escapeHtml(alert.detail)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="font-family:sans-serif;color:#1c1917;">
  <h1 style="font-size:18px;">SEO Health 경고</h1>
  <p style="font-size:13px;">다음 지표가 임계값을 초과했습니다. /admin/seo-health 페이지에서 상세를 확인하세요.</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead><tr><th style="padding:8px;border:1px solid #eee;text-align:left;">지표</th><th style="padding:8px;border:1px solid #eee;text-align:left;">값</th><th style="padding:8px;border:1px solid #eee;text-align:left;">등급</th><th style="padding:8px;border:1px solid #eee;text-align:left;">상세</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

async function loadModule(relPath) {
  const tsxLoader = await import("tsx/esm/api").catch(() => null);
  if (tsxLoader?.tsImport) {
    return tsxLoader.tsImport(path.join(ROOT, relPath), import.meta.url);
  }
  throw new Error(
    "tsx 로더가 필요합니다. `npm install -D tsx` 후 `npx tsx scripts/monitor-seo-health.mjs` 로 실행하세요."
  );
}

main().catch((error) => {
  console.error("[monitor-seo-health] 실패:", error);
  process.exit(1);
});
