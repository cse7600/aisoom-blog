#!/usr/bin/env node
/**
 * GSC OAuth2 최초 셋업 — 로컬 서버로 자동 토큰 수신
 * Usage: node scripts/gsc-setup.mjs
 *
 * 1. 로컬 포트 8080에 임시 서버 시작
 * 2. 브라우저 자동 오픈 (구글 로그인)
 * 3. 승인 후 refresh_token 자동 출력 및 .env.local 저장
 */

import { google } from "googleapis";
import { createServer } from "http";
import { exec } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const ENV_FILE = resolve(process.cwd(), ".env.local");

const client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
});

console.log("\n=== GSC OAuth2 셋업 ===");
console.log("로컬 서버 시작 중...\n");

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2>인증 실패: ${error ?? "code 없음"}</h2><p>터미널을 확인하세요.</p>`);
    server.close();
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>refresh_token 없음</h2><p>GCP Console에서 앱 승인을 취소 후 다시 시도하세요.</p>");
      server.close();
      return;
    }

    // .env.local 자동 업데이트
    let env = readFileSync(ENV_FILE, "utf-8");
    if (env.includes("GOOGLE_GSC_REFRESH_TOKEN=")) {
      env = env.replace(/GOOGLE_GSC_REFRESH_TOKEN=.*/, `GOOGLE_GSC_REFRESH_TOKEN=${refreshToken}`);
    } else {
      env += `\nGOOGLE_GSC_REFRESH_TOKEN=${refreshToken}\n`;
    }
    writeFileSync(ENV_FILE, env);

    console.log("\n✅ 성공!");
    console.log(`refresh_token: ${refreshToken}`);
    console.log("\n.env.local 자동 저장 완료.");
    console.log("Vercel에도 등록 필요:\n");
    console.log(`  vercel env add GOOGLE_GSC_REFRESH_TOKEN production`);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family:sans-serif;padding:40px">
      <h2>✅ GSC 인증 완료!</h2>
      <p>터미널로 돌아가서 refresh_token을 Vercel에 등록하세요.</p>
      <pre style="background:#f0f0f0;padding:12px">${refreshToken}</pre>
      <p>이 창을 닫아도 됩니다.</p>
      </body></html>
    `);
    server.close();
  } catch (err) {
    console.error("❌ 토큰 교환 실패:", err.message);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2>오류: ${err.message}</h2>`);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`대기 중: http://localhost:${PORT}`);
  console.log("브라우저를 열고 구글 계정으로 로그인하세요...\n");
  exec(`open "${authUrl}"`);
});
