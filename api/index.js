// ============================================================
// Vercel Serverless Function  -  Homepage with fresh blog cards (SSR)
// Reads /index.html, injects the 6 latest published EN articles from Notion
// into the BLOG_CARDS_START..END block, returns the result with edge cache.
// Goal: crawler-visible internal links to the LATEST articles in raw HTML.
// Route: /  (via vercel.json rewrite)
// Falls back to the unmodified index.html if Notion fetch fails.
// ============================================================

const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_BLOG_DB_ID;

// Read homepage template once at cold start and cache (reused across warm invocations).
// File is named _index.html so Vercel's filesystem lookup for "/" misses and the
// "/" → "/api/index" rewrite actually fires.
let INDEX_HTML = "";
try {
  // 2026-06-09: Vercel's `functions.includeFiles` config stopped accepting
  // `api/index.js` as a pattern ("doesn't match any Serverless Functions").
  // Workaround: keep a copy of _index.html INSIDE api/ — Vercel auto-bundles
  // files next to a function — and try the in-dir copy first, falling back
  // to project root for local dev and older deploys that include both.
  try {
    INDEX_HTML = fs.readFileSync(path.join(__dirname, "_index.html"), "utf8");
  } catch (innerErr) {
    INDEX_HTML = fs.readFileSync(path.join(__dirname, "..", "_index.html"), "utf8");
  }
  INDEX_HTML = minifyHtml(INDEX_HTML);
} catch (e) {
  console.error("[/api/index] failed to load _index.html:", e && e.message);
}

/* Safe HTML minifier (no external deps).
   - Strips HTML comments EXCEPT IE conditional comments (<!--[if ... ]>) and
     SSR markers we depend on (BLOG_CARDS_START/END).
   - Collapses whitespace between tags down to a single space, but PRESERVES
     content of <script>, <style>, <pre>, <textarea>, <code> tags verbatim.
   - Removes leading/trailing whitespace on each line outside protected tags.
   Typical savings on legalsol homepage: ~30-40% of file size, zero behavior
   change because all semantic whitespace inside <script>/<style> is kept. */
function minifyHtml(html) {
  if (!html) return html;
  const PROTECTED = /<(script|style|pre|textarea|code)([\s\S]*?)<\/\1>/gi;
  const placeholders = [];
  let i = 0;
  // 1. Stash protected blocks
  let s = html.replace(PROTECTED, (m) => {
    const token = `__MINPROT${i++}__`;
    placeholders.push(m);
    return token;
  });
  // 2. Drop comments — but KEEP markers we use for SSR injection + IE conditionals
  s = s.replace(/<!--[\s\S]*?-->/g, (m) => {
    if (m.startsWith("<!--[if") || m.startsWith("<![endif")) return m;
    if (m.includes("BLOG_CARDS_START") || m.includes("BLOG_CARDS_END")) return m;
    return "";
  });
  // 3. Collapse runs of whitespace between tags to a single space
  s = s.replace(/>\s+</g, "> <");
  // 4. Drop leading/trailing whitespace on each line and collapse blank lines
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{2,}/g, "\n");
  // 5. Restore protected blocks
  s = s.replace(/__MINPROT(\d+)__/g, (_, n) => placeholders[Number(n)]);
  return s;
}

// Category fallback covers (kept in sync with /api/blog-listing.js)
const CAT_IMAGES = {
  "TAXES":            "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&w=600&q=75",
  "RESIDENCE PERMIT": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&w=600&q=75",
  "PESEL":            "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&w=600&q=75",
  "BUSINESS":         "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&w=600&q=75",
  "APPEALS":          "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&w=600&q=75",
  "PROFIL ZAUFANY":   "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&w=600&q=75",
  "BLUE CARD":        "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&w=600&q=75",
  "CUKR":             "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&w=600&q=75",
  "GUIDES":           "https://images.unsplash.com/photo-1521791055366-0d553872952f?auto=format&w=600&q=75",
  "GUIDE":            "https://images.unsplash.com/photo-1521791055366-0d553872952f?auto=format&w=600&q=75",
  "LEGAL":            "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&w=600&q=75",
  "LIFESTYLE":        "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&w=600&q=75",
  "FINANCE":          "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&w=600&q=75",
  "LIFEHACK":         "https://images.unsplash.com/photo-1484807352052-23338990c6c6?auto=format&w=600&q=75",
  "DEFAULT":          "https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&w=600&q=75",
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getPropertyText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "date") return prop.date?.start || "";
  if (prop.type === "files") {
    const f = prop.files?.[0];
    if (!f) return "";
    return f.type === "external" ? f.external.url : f.file?.url || "";
  }
  return "";
}

function pickCover(rawCover, category) {
  const fallback = CAT_IMAGES[(category || "").toUpperCase()] || CAT_IMAGES.DEFAULT;
  if (!rawCover) return fallback;
  if (rawCover.includes("s3.amazonaws.com") || rawCover.includes("prod-files-secure") || rawCover.includes("secure.notion-static")) return fallback;
  return rawCover;
}

function formatDateEn(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
}

function renderCard(a) {
  const cover = pickCover(a.cover, a.category);
  const cat = (a.category || "").toUpperCase();
  return `      <a class="blog-card reveal" href="/blog/${escapeHtml(a.slug)}" style="text-decoration:none;display:block;color:inherit">

        <div class="blog-thumb" style="overflow:hidden;background:#1a1638;"><img src="${escapeHtml(cover)}" alt="${escapeHtml(a.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;opacity:.78;"/><div class="blog-cat">${escapeHtml(cat)}</div></div>

        <div class="blog-body"><div class="blog-date">${escapeHtml(formatDateEn(a.publishedDate))}</div><div class="blog-t">${escapeHtml(a.title)}</div><div class="blog-e">${escapeHtml(a.description || "")}</div><span class="blog-read">Read →</span></div>

      </a>`;
}

const MARKER_RE = /<!-- BLOG_CARDS_START[\s\S]*?<!-- BLOG_CARDS_END -->/;

function fallback(res, code = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=86400");
  res.setHeader("X-SSR-Status", "fallback");
  res.status(code).send(INDEX_HTML || "");
}

module.exports = async function handler(req, res) {
  if (!INDEX_HTML) {
    res.status(500).send("Homepage template not loaded");
    return;
  }
  if (!process.env.NOTION_API_KEY || !DATABASE_ID) {
    return fallback(res, 200);
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: "Status", select: { equals: "Published" } },
          { property: "Language", select: { equals: "EN" } },
        ],
      },
      sorts: [{ property: "Published Date", direction: "descending" }],
      page_size: 6,
    });

    const articles = response.results.map(page => {
      const props = page.properties || {};
      return {
        title: getPropertyText(props.Title),
        slug: getPropertyText(props.Slug),
        category: getPropertyText(props.Category),
        description: getPropertyText(props["SEO Description"]),
        publishedDate: getPropertyText(props["Published Date"]),
        cover: getPropertyText(props["Cover Image"]),
      };
    }).filter(a => a.slug && a.title);

    if (articles.length === 0) {
      return fallback(res, 200);
    }

    const freshBlock = `<!-- BLOG_CARDS_START (SSR-injected ${new Date().toISOString()}) -->
    <div class="blog-grid">
${articles.map(renderCard).join("\n\n")}

    </div>
    <!-- BLOG_CARDS_END -->`;

    const html = INDEX_HTML.replace(MARKER_RE, freshBlock);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    res.setHeader("X-SSR-Status", "ok");
    res.status(200).send(html);
  } catch (err) {
    console.error("[/api/index] error:", err && err.message);
    return fallback(res, 200);
  }
};
