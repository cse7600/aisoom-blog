#!/usr/bin/env node
/**
 * 콘텐츠 루프 자동 스케줄링 설정
 *
 * 두 가지 모드:
 * 1. launchd (Mac) — LaunchAgent plist 설치 → 시스템 백그라운드 실행
 * 2. cron — crontab 항목 출력 (수동 추가)
 *
 * Usage:
 *   node scripts/setup-schedule.mjs install   # launchd plist 설치
 *   node scripts/setup-schedule.mjs uninstall # launchd plist 제거
 *   node scripts/setup-schedule.mjs status    # 현재 상태 확인
 *   node scripts/setup-schedule.mjs cron      # crontab 항목 출력
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PLIST_LABEL = "com.kkulinfo.content-loop";
const PLIST_PATH = path.join(
  process.env.HOME,
  "Library/LaunchAgents",
  `${PLIST_LABEL}.plist`
);
const LOG_DIR = path.join(ROOT, "logs");
const NODE_PATH = process.execPath; // 현재 node 실행 경로

// 주 5회 스케줄 (월~금 오전 8:30)
const SCHEDULE = {
  Minute: 30,
  Hour: 8,
  Weekday: [1, 2, 3, 4, 5], // 1=월 ... 5=금
};

// ─── plist 생성 ─────────────────────────────────────────────────────────────

function buildPlist() {
  const weekdayStr = SCHEDULE.Weekday.map(
    (d) => `        <integer>${d}</integer>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${path.join(ROOT, "scripts/content-loop.mjs")}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${ROOT}</string>

  <key>StartCalendarInterval</key>
  <array>
${SCHEDULE.Weekday.map(
  (d) => `    <dict>
      <key>Weekday</key>
      <integer>${d}</integer>
      <key>Hour</key>
      <integer>${SCHEDULE.Hour}</integer>
      <key>Minute</key>
      <integer>${SCHEDULE.Minute}</integer>
    </dict>`
).join("\n")}
  </array>

  <key>StandardOutPath</key>
  <string>${path.join(LOG_DIR, "content-loop.log")}</string>

  <key>StandardErrorPath</key>
  <string>${path.join(LOG_DIR, "content-loop-error.log")}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${process.env.HOME}</string>
    <key>PATH</key>
    <string>${process.env.PATH}</string>
  </dict>

  <key>RunAtLoad</key>
  <false/>

  <key>KeepAlive</key>
  <false/>
</dict>
</plist>`;
}

// ─── install ─────────────────────────────────────────────────────────────────

function install() {
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const plist = buildPlist();
  fs.writeFileSync(PLIST_PATH, plist);
  console.log(`  [plist] 저장: ${PLIST_PATH}`);

  try {
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "pipe" });
    console.log(`  [launchd] 로드 완료`);
  } catch (err) {
    // 이미 로드된 경우 unload 후 재로드
    try {
      execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: "pipe" });
      execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "pipe" });
      console.log(`  [launchd] 재로드 완료`);
    } catch {
      console.warn(`  [경고] launchctl 실패: ${err.message.slice(0, 100)}`);
    }
  }

  console.log(`
스케줄 등록 완료:
  - 실행 시각: 월~금 오전 ${SCHEDULE.Hour}:${String(SCHEDULE.Minute).padStart(2, "0")}
  - 로그 파일: ${LOG_DIR}/content-loop.log
  - 에러 로그: ${LOG_DIR}/content-loop-error.log

수동 즉시 실행:
  launchctl start ${PLIST_LABEL}

상태 확인:
  node scripts/setup-schedule.mjs status
`);
}

// ─── uninstall ───────────────────────────────────────────────────────────────

function uninstall() {
  if (!fs.existsSync(PLIST_PATH)) {
    console.log("설치된 스케줄 없음");
    return;
  }
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: "pipe" });
  } catch {
    // 이미 언로드됨
  }
  fs.unlinkSync(PLIST_PATH);
  console.log(`스케줄 제거 완료: ${PLIST_PATH}`);
}

// ─── status ──────────────────────────────────────────────────────────────────

function status() {
  const plistExists = fs.existsSync(PLIST_PATH);
  console.log(`\n[스케줄 상태]`);
  console.log(`  plist 파일: ${plistExists ? "존재" : "없음"} (${PLIST_PATH})`);

  if (plistExists) {
    try {
      const out = execSync(`launchctl list | grep ${PLIST_LABEL}`, {
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
      console.log(`  launchd: ${out || "등록됨"}`);
    } catch {
      console.log(`  launchd: 미로드 (plist는 있지만 launchctl list에 없음)`);
    }
  }

  const logPath = path.join(LOG_DIR, "content-loop.log");
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
    const last = lines.slice(-5).join("\n");
    console.log(`\n  최근 로그 (마지막 5줄):\n${last}`);
  } else {
    console.log(`  로그: 없음 (아직 미실행)`);
  }
}

// ─── cron 출력 ───────────────────────────────────────────────────────────────

function printCron() {
  const script = path.join(ROOT, "scripts/content-loop.mjs");
  const logPath = path.join(LOG_DIR, "content-loop.log");
  console.log(`
# crontab -e 에 아래 줄 추가 (월~금 오전 8:30):
30 8 * * 1-5 ${NODE_PATH} ${script} >> ${logPath} 2>&1
`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const cmd = process.argv[2];
if (cmd === "install") install();
else if (cmd === "uninstall") uninstall();
else if (cmd === "status") status();
else if (cmd === "cron") printCron();
else {
  console.log(`
Usage:
  node scripts/setup-schedule.mjs install    # Mac launchd 등록 (월~금 08:30)
  node scripts/setup-schedule.mjs uninstall  # 스케줄 제거
  node scripts/setup-schedule.mjs status     # 상태 + 최근 로그
  node scripts/setup-schedule.mjs cron       # crontab 항목 출력
`);
}
