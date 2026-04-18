// Vercel Serverless Function — Dynamic Sitemap XML
// Route: /sitemap.xml
// Includes: main page + /blog + all published blog articles from Notion

const { Client } = require("@notionhq/client");

const SITE = "https://www.legalsol.pl";

function txt(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map(t => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map(t => t.plain_text).join("");
  if (p.type === "date") return (p.date || {}).start || "";
  return "";
}

module.exports = async function handler(req, res) {
  const staticUrls = [
    { loc: `${SITE}/`,      priority: "1.0", changefreq: "weekly"  },
    { loc: `${SITE}/blog`,  priority: "0.9", changefreq: "daily"   },
  ];

  let articleUrls = [];
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DB = process.env.NOTION_BLOG_DB_ID;
    const r = await notion.databases.query({
      database_id: DB,
      filter: { property: "Status", select: { equals: "Published" } },
      sorts: [{ property: "Published Date", direction: "descending" }],
      page_size: 100,
    });
    articleUrls = r.results.map(pg => {
      const p = pg.properties;
      const slug = txt(p["Slug"]);
      const date = txt(p["Published Date"]);
      return slug ? {
        loc: `${SITE}/blog/${slug}`,
        slug: slug,
        lastmod: date || undefined,
        priority: "0.8",
        changefreq: "monthly",
      } : null;
    }).filter(Boolean);
  } catch (e) {
    // If Notion fails, serve static-only sitemap
    console.error("sitemap notion error:", e.message);
  }

  const allUrls = [...staticUrls, ...articleUrls];
  const today = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls.map(u => {
    // For blog articles, add hreflang alternates for EN/RU pairs
    let hreflang = '';
    if (u.loc.startsWith(SITE + '/blog/') && u.slug) {
      const isEn = u.slug.endsWith('-en');
      const ruSlug = isEn ? u.slug.replace(/-en$/, '') : u.slug;
      const enSlug = isEn ? u.slug : u.slug + '-en';
      hreflang = `
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE}/blog/${ruSlug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/blog/${enSlug}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/blog/${enSlug}"/>`;
    }
    return `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : `<lastmod>${today}</lastmod>`}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${hreflang}
  </url>`;
  }).join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600");
  res.status(200).send(xml);
};
