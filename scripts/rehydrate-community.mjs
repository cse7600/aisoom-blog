#!/usr/bin/env node
/**
 * Phase 9.2 — community_posts / community_comments 재수화
 *
 * 목적:
 *   1) 32개 community_posts + 96개 community_comments 의 ip_hash NULL 값 → 다양화
 *   2) 타임스탬프 한국 활성 시간대 재분산 (post별 7~21일 spread)
 *   3) view_count 를 포스트 경과일 기반 추정값으로 재설정 (300 고정값 제거)
 *
 * 사용법:
 *   node scripts/rehydrate-community.mjs --dry
 *   node scripts/rehydrate-community.mjs
 *   node scripts/rehydrate-community.mjs --ip-only
 *   node scripts/rehydrate-community.mjs --views-only
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
  pickReplyTimestamp,
  estimateViewCount,
  snapToActiveWindow,
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
const viewsOnly = process.argv.includes("--views-only");

async function fetchPosts() {
  const { data, error } = await supabase
    .from("community_posts")
    .select("id,created_at,view_count")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`community_posts fetch: ${error.message}`);
  return data ?? [];
}

async function fetchCommentsForPost(postId) {
  const { data, error } = await supabase
    .from("community_comments")
    .select("id,parent_id,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`comments fetch ${postId}: ${error.message}`);
  return data ?? [];
}

function spreadPostAnchor(post, index, total) {
  // 가장 오래된 포스트부터 순차적으로 14~30일 이전으로 분산 배치
  const daysAgo = 3 + Math.random() * 25 + index * 0.8;
  const base = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  return snapToActiveWindow(base);
}

async function updatePost(postId, patch) {
  if (isDryRun) return;
  const { error } = await supabase
    .from("community_posts")
    .update(patch)
    .eq("id", postId);
  if (error) console.error(`  post update ${postId}: ${error.message}`);
}

async function updateComment(commentId, patch) {
  if (isDryRun) return;
  const { error } = await supabase
    .from("community_comments")
    .update(patch)
    .eq("id", commentId);
  if (error) console.error(`  comment update ${commentId}: ${error.message}`);
}

async function main() {
  console.log(`[rehydrate-community] dryRun=${isDryRun} ipOnly=${ipOnly} viewsOnly=${viewsOnly}`);
  const posts = await fetchPosts();
  console.log(`posts: ${posts.length}`);

  let seedCounter = 5000;
  let stats = { posts: 0, comments: 0, viewsUpdated: 0 };

  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    const comments = await fetchCommentsForPost(post.id);

    const ipHash = generateFakeIpHash(seedCounter);
    seedCounter += 1;

    const postPatch = {};
    if (!viewsOnly) postPatch.ip_hash = ipHash;

    // 타임스탬프 재설정 (ipOnly / viewsOnly 아닐 때만)
    let newPostTime = post.created_at ? new Date(post.created_at) : new Date();
    if (!ipOnly && !viewsOnly) {
      newPostTime = spreadPostAnchor(post, index, posts.length);
      postPatch.created_at = newPostTime.toISOString();
    }

    // view_count 추정 (ipOnly 아닐 때)
    if (!ipOnly) {
      const estimatedViews = estimateViewCount(newPostTime, {
        baseDaily: 2.5,
        decayHalfLife: 6,
      });
      postPatch.view_count = estimatedViews;
      stats.viewsUpdated += 1;
    }

    if (Object.keys(postPatch).length > 0) {
      await updatePost(post.id, postPatch);
      stats.posts += 1;
    }

    // 댓글 타임스탬프 + ip_hash
    if (!viewsOnly && comments.length > 0) {
      const topLevel = comments.filter((c) => !c.parent_id);
      const children = comments.filter((c) => c.parent_id);

      const topTimes = distributeCommentTimestamps(newPostTime, topLevel.length, {
        maxDays: 14,
        peakBiasDays: 2,
      });

      const parentTimeMap = new Map();
      for (let ti = 0; ti < topLevel.length; ti += 1) {
        const comment = topLevel[ti];
        const newTime = topTimes[ti];
        parentTimeMap.set(comment.id, newTime);
        const patch = { ip_hash: generateFakeIpHash(seedCounter++) };
        if (!ipOnly) patch.created_at = newTime.toISOString();
        await updateComment(comment.id, patch);
        stats.comments += 1;
      }

      for (const child of children) {
        const parentTime = parentTimeMap.get(child.parent_id) ?? newPostTime;
        const childTime = pickReplyTimestamp(parentTime);
        const patch = { ip_hash: generateFakeIpHash(seedCounter++) };
        if (!ipOnly) patch.created_at = childTime.toISOString();
        await updateComment(child.id, patch);
        stats.comments += 1;
      }
    }

    console.log(
      `  post ${post.id.slice(0, 8)} comments=${comments.length} anchor=${newPostTime
        .toISOString()
        .slice(0, 10)}`
    );
  }

  console.log(
    `[done] posts=${stats.posts} comments=${stats.comments} viewsUpdated=${stats.viewsUpdated}`
  );
  if (isDryRun) console.log("[dry-run] 실제 DB 변경 없음.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
