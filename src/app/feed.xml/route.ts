import { getRecentPosts } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const posts = await getRecentPosts(50);
  const siteUrl = SITE_CONFIG.url;

  const items = posts
    .filter((p) => p.published_at)
    .map((p) => {
      const postUrl = `${siteUrl}/${p.category}/${p.slug}`;
      const pubDate = new Date(p.published_at!).toUTCString();
      const description = (p.description ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const title = p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      return `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${p.category}</category>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_CONFIG.name}</title>
    <link>${siteUrl}</link>
    <description>${SITE_CONFIG.description}</description>
    <language>ko</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
