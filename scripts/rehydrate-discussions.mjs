#!/usr/bin/env node
/**
 * Phase 9.2 — 기존 post_discussions / discussion_replies 재수화
 *
 * 문제: 기존 240개 댓글이 24h 내로 뭉쳐있고 ip_hash NULL, 시간대 편향 (03~07시 포함).
 * 해결: 포스트 발행일 기준 7~21일 자연 분산 + 활성 시간대 스냅 + IP hash 채움.
 *
 * 사용법:
 *   node scripts/rehydrate-discussions.mjs --dry   (시뮬레이션)
 *   node scripts/rehydrate-discussions.mjs         (실제 업데이트)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
  pickReplyTimestamp,
} from "./lib/anti-bot-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes("--dry");
const ipOnly = process.argv.includes("--ip-only");

async function fetchPostsWithDiscussions() {
  const { data, error } = await supabase
    .from("posts")
    .select("slug,published_at,created_at")
    .eq("status", "published")
    .order("published_at", { ascending: true });
  if (error) throw new Error(`posts fetch: ${error.message}`);
  return data ?? [];
}

async function fetchDiscussionsForPost(slug) {
  const { data, error } = await supabase
    .from("post_discussions")
    .select("id,content,is_question,created_at")
    .eq("post_slug", slug)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`disc fetch ${slug}: ${error.message}`);
  return data ?? [];
}

async function fetchRepliesForDiscussion(discussionId) {
  const { data, error } = await supabase
    .from("discussion_replies")
    .select("id,content")
    .eq("discussion_id", discussionId);
  if (error) throw new Error(`reply fetch ${discussionId}: ${error.message}`);
  return data ?? [];
}

function pickAnchorDate(post) {
  const raw = post.published_at ?? post.created_at;
  const published = raw ? new Date(raw) : new Date(Date.now() - 10 * 24 * 3600 * 1000);
  // 발행일 + 30분~4시간 후부터 첫 댓글이 가능하도록 약간 offset
  return new Date(published.getTime() + (30 + Math.random() * 210) * 60 * 1000);
}

let hasDiscussionIpHash = null;
let hasReplyIpHash = null;

async function detectIpHashColumns() {
  const { error: discErr } = await supabase
    .from("post_discussions")
    .select("ip_hash")
    .limit(1);
  hasDiscussionIpHash = !discErr;

  const { error: repErr } = await supabase
    .from("discussion_replies")
    .select("ip_hash")
    .limit(1);
  hasReplyIpHash = !repErr;

  console.log(
    `  schema: post_discussions.ip_hash=${hasDiscussionIpHash} discussion_replies.ip_hash=${hasReplyIpHash}`
  );
}

async function updateDiscussion(id, createdAt, ipHash) {
  if (isDryRun) return;
  const patch = {};
  if (!ipOnly) patch.created_at = createdAt.toISOString();
  if (hasDiscussionIpHash) patch.ip_hash = ipHash;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from("post_discussions")
    .update(patch)
    .eq("id", id);
  if (error) console.error(`  disc update ${id}: ${error.message}`);
}

async function updateReply(id, createdAt, ipHash) {
  if (isDryRun) return;
  const patch = {};
  if (!ipOnly) patch.created_at = createdAt.toISOString();
  if (hasReplyIpHash) patch.ip_hash = ipHash;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from("discussion_replies")
    .update(patch)
    .eq("id", id);
  if (error) console.error(`  reply update ${id}: ${error.message}`);
}

async function main() {
  console.log(`[rehydrate-discussions] dryRun=${isDryRun}`);
  await detectIpHashColumns();
  const posts = await fetchPostsWithDiscussions();
  console.log(`posts: ${posts.length}`);

  let stats = { discussions: 0, replies: 0, posts: 0 };
  let seedCounter = 1000;

  for (const post of posts) {
    const discussions = await fetchDiscussionsForPost(post.slug);
    if (discussions.length === 0) continue;

    stats.posts += 1;
    const anchor = pickAnchorDate(post);
    const newTimestamps = distributeCommentTimestamps(anchor, discussions.length, {
      maxDays: 18,
      peakBiasDays: 2.5,
    });

    for (let index = 0; index < discussions.length; index += 1) {
      const disc = discussions[index];
      const newTime = newTimestamps[index];
      const ipHash = generateFakeIpHash(seedCounter);
      seedCounter += 1;

      await updateDiscussion(disc.id, newTime, ipHash);
      stats.discussions += 1;

      const replies = await fetchRepliesForDiscussion(disc.id);
      for (const reply of replies) {
        const replyTime = pickReplyTimestamp(newTime);
        const replyIpHash = generateFakeIpHash(seedCounter);
        seedCounter += 1;
        await updateReply(reply.id, replyTime, replyIpHash);
        stats.replies += 1;
      }
    }

    console.log(
      `  ${post.slug.slice(0, 45).padEnd(45)} disc=${discussions.length} span=${anchor
        .toISOString()
        .slice(0, 10)}`
    );
  }

  console.log(
    `[done] posts=${stats.posts} disc=${stats.discussions} replies=${stats.replies}`
  );
  if (isDryRun) console.log("[dry-run] 실제 DB는 변경되지 않았습니다.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
