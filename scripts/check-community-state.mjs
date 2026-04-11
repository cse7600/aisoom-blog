import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
const ROOT = process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const discussions = await db.from("post_discussions").select("post_slug,content,is_question,created_at", { count: "exact" });
console.log("post_discussions 총 개수:", discussions.count);
if (discussions.data) {
  const lens = discussions.data.map(d => d.content?.length ?? 0);
  const avg = lens.reduce((a,b)=>a+b,0)/lens.length;
  const qCount = discussions.data.filter(d => d.is_question).length;
  console.log("평균 길이:", avg.toFixed(1));
  console.log("질문 비율:", (qCount/discussions.data.length*100).toFixed(1) + "%");
  console.log("길이 분포 <80:", lens.filter(l=>l<80).length);
  console.log("길이 분포 80~150:", lens.filter(l=>l>=80&&l<150).length);
  console.log("길이 분포 150~300:", lens.filter(l=>l>=150&&l<300).length);
  console.log("길이 분포 300+:", lens.filter(l=>l>=300).length);
  const slugs = new Set(discussions.data.map(d=>d.post_slug));
  console.log("포스트 수:", slugs.size);
  // 시간 분포 - 각 포스트 첫 댓글과 마지막 댓글
  const bySlug = {};
  for (const d of discussions.data) {
    if (!bySlug[d.post_slug]) bySlug[d.post_slug] = [];
    bySlug[d.post_slug].push(new Date(d.created_at).getTime());
  }
  let clusterCount = 0;
  for (const slug of Object.keys(bySlug)) {
    const times = bySlug[slug].sort();
    const spanHours = (times[times.length-1]-times[0])/1000/3600;
    if (spanHours < 24) clusterCount++;
  }
  console.log(`24시간 이내 뭉친 포스트: ${clusterCount}/${slugs.size}`);
}

const cposts = await db.from("community_posts").select("id,category,ip_hash,view_count,comment_count,is_ai_generated,created_at,persona_id", { count: "exact" });
console.log("\n--- community_posts ---");
console.log("총 개수:", cposts.count);
if (cposts.data) {
  console.log("AI 생성:", cposts.data.filter(p=>p.is_ai_generated).length);
  console.log("ip_hash NULL:", cposts.data.filter(p=>!p.ip_hash).length);
  console.log("view_count=0:", cposts.data.filter(p=>p.view_count===0).length);
  const vcs = cposts.data.map(p=>p.view_count).filter(v=>v!==null);
  console.log("view_count 분포:", JSON.stringify({min:Math.min(...vcs),max:Math.max(...vcs),avg:(vcs.reduce((a,b)=>a+b,0)/vcs.length).toFixed(1)}));
  const byCat = {};
  for (const p of cposts.data) byCat[p.category] = (byCat[p.category]||0)+1;
  console.log("카테고리별:", byCat);
}

const ccomments = await db.from("community_comments").select("ip_hash,content,created_at,is_ai_generated", { count: "exact" });
console.log("\n--- community_comments ---");
console.log("총 개수:", ccomments.count);
if (ccomments.data) {
  console.log("AI:", ccomments.data.filter(c=>c.is_ai_generated).length);
  console.log("ip_hash NULL:", ccomments.data.filter(c=>!c.ip_hash).length);
  const lens = ccomments.data.map(c=>c.content?.length??0);
  console.log("평균 길이:", (lens.reduce((a,b)=>a+b,0)/lens.length).toFixed(1));
}
