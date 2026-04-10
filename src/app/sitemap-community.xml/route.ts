import { NextResponse } from "next/server";
import { SITE_CONFIG } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase";

export const revalidate = 3600;

interface CommunityPostRow {
  id: string;
  updated_at: string;
  created_at: string;
}

interface CommunityUrlEntry {
  loc: string;
  lastmod: string;
}

export async function GET() {
  const entries = await fetchCommunityEntries();
  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

async function fetchCommunityEntries(): Promise<CommunityUrlEntry[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_posts")
    .select("id,updated_at,created_at")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[sitemap-community] fetch:", error.message);
    return [];
  }
  const rows = (data ?? []) as CommunityPostRow[];
  return rows.map((row) => ({
    loc: `${SITE_CONFIG.url}/community/${row.id}`,
    lastmod: new Date(row.updated_at ?? row.created_at).toISOString(),
  }));
}

function buildSitemapXml(entries: CommunityUrlEntry[]): string {
  const urlNodes = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
