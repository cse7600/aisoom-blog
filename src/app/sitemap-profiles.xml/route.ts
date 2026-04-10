import { NextResponse } from "next/server";
import { SITE_CONFIG } from "@/lib/constants";
import { getPersonas } from "@/lib/discussion-db";

export const revalidate = 3600;

interface ProfileUrlEntry {
  loc: string;
  lastmod: string;
}

export async function GET() {
  const personas = await getPersonas(true);
  const entries: ProfileUrlEntry[] = personas.map((persona) => ({
    loc: `${SITE_CONFIG.url}/community/users/${encodeURIComponent(persona.nickname)}`,
    lastmod: new Date(persona.created_at).toISOString(),
  }));

  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function buildSitemapXml(entries: ProfileUrlEntry[]): string {
  const urlNodes = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.4</priority>\n  </url>`
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
