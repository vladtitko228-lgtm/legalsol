// ============================================================
// Vercel Serverless Function â Blog Listing Page
// SSR page listing all published articles from Notion
// Route: /blog  (via vercel.json rewrite)
// ============================================================

const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_BLOG_DB_ID;

function getPropertyText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "multi_select") return prop.multi_select?.map(s => s.name) || [];
  if (prop.type === "date") return prop.date?.start || "";
  if (prop.type === "files") {
    const f = prop.files?.[0];
    if (!f) return "";
    return f.type === "external" ? f.external.url : f.file?.url || "";
  }
  return "";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderArticleCard(article) {
  const dateStr = article.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const coverHtml = article.coverImage
    ? `<div class="card-cover"><img src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}" loading="lazy" style="width:100%;height:200px;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><div class="card-cover-placeholder" style="display:none;height:200px;"></div></div>`
    : `<div class="card-cover card-cover-placeholder"></div>`;

  const tagsHtml = Array.isArray(article.tags) && article.tags.length
    ? article.tags.slice(0, 3).map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join("")
    : "";

  return `
    <a href="/blog/${escapeHtml(article.slug)}" class="article-card">
      ${coverHtml}
      <div class="card-body">
        <div class="card-meta">
          ${article.category ? `<span class="card-category">${escapeHtml(article.category)}</span>` : ""}
          ${dateStr ? `<span class="card-date">${dateStr}</span>` : ""}
        </div>
        <h2 class="card-title">${escapeHtml(article.title)}</h2>
        <p class="card-desc">${escapeHtml(article.seoDescription)}</p>
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
      </div>
    </a>`;
}

function renderPage(articles) {
  const cardsHtml = articles.map(renderArticleCard).join("\n");
  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];
  const filterHtml = categories.map(c =>
    `<button class="filter-btn" onclick="filterCategory('${escapeHtml(c)}')">${escapeHtml(c)}</button>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog â Legal Solutions | Immigration Guides for Poland</title>
  <meta name="description" content="Expert guides on immigration to Poland: karta pobytu, work permits, PESEL, business registration, and more. Free resources from Legal Solutions.">
  <link rel="canonical" href="https://www.legalsol.pl/blog">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog â Legal Solutions">
  <meta property="og:description" content="Expert immigration guides for Poland">
  <meta property="og:url" content="https://www.legalsol.pl/blog">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Legal Solutions Blog",
    "description": "Expert guides on immigration to Poland",
    "url": "https://www.legalsol.pl/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Legal Solutions",
      "url": "https://www.legalsol.pl"
    }
  }
  </script>

  <style>
    :root {
      --bg: #0d0d2b;
      --card-bg: #141432;
      --text: #e0e0e0;
      --text-muted: #9090b0;
      --accent: #7c5cfc;
      --accent-light: #a78bfa;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
    }

    /* Header */
    .header {
      background: rgba(13,13,43,0.95);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(124,92,252,0.2);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      color: white;
      font-weight: 800;
      font-size: 18px;
      text-decoration: none;
      letter-spacing: 2px;
    }
    .logo span { color: var(--accent); }
    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      margin-left: 24px;
      font-size: 14px;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: white; }
    .btn-consult {
      background: var(--accent);
      color: white;
      padding: 8px 20px;
      border-radius: 24px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      margin-left: 24px;
    }

    /* Hero */
    .blog-hero {
      max-width: 1200px;
      margin: 0 auto;
      padding: 60px 24px 40px;
      text-align: center;
    }
    .blog-hero h1 {
      font-size: 2.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, #fff, var(--accent-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }
    .blog-hero p {
      color: var(--text-muted);
      font-size: 1.15rem;
      max-width: 600px;
      margin: 0 auto;
    }

    /* Filters */
    .filters {
      max-width: 1200px;
      margin: 0 auto 32px;
      padding: 0 24px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .filter-btn {
      background: var(--card-bg);
      color: var(--text-muted);
      border: 1px solid rgba(124,92,252,0.15);
      padding: 8px 20px;
      border-radius: 24px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: rgba(124,92,252,0.15);
      color: var(--accent-light);
      border-color: var(--accent);
    }

    /* Grid */
    .articles-grid {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 60px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 28px;
    }

    /* Card */
    .article-card {
      background: var(--card-bg);
      border: 1px solid rgba(124,92,252,0.1);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
      word-break: break-word;
    }
    .article-card:hover {
      transform: translateY(-6px);
      border-color: rgba(124,92,252,0.4);
      box-shadow: 0 12px 40px rgba(124,92,252,0.15);
    }
    .card-cover {
      width: 100%;
      height: 200px;
      overflow: hidden;
      border-radius: 12px 12px 0 0;
      flex-shrink: 0;
    }
    .card-cover-placeholder {
      width: 100%;
      height: 200px;
      background: linear-gradient(135deg, #2D2869, #5B52CC);
      border-radius: 12px 12px 0 0;
      flex-shrink: 0;
    }

    .card-body { padding: 24px; }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .card-category {
      background: rgba(124,92,252,0.15);
      color: var(--accent-light);
      padding: 3px 12px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .card-date { color: var(--text-muted); font-size: 13px; }
    .card-title {
      font-size: clamp(14px, 2vw, 18px);
      font-weight: 700;
      color: white;
      margin-bottom: 10px;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .card-desc {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-tags {
      display: flex;
      gap: 8px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .card-tag {
      color: var(--accent-light);
      font-size: 12px;
      opacity: 0.7;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 80px 24px;
      grid-column: 1 / -1;
    }
    .empty-state h2 { color: var(--text-muted); font-size: 1.4rem; margin-bottom: 8px; }
    .empty-state p { color: var(--text-muted); opacity: 0.7; }

    /* Footer */
    .footer {
      background: var(--card-bg);
      border-top: 1px solid rgba(255,255,255,0.05);
      padding: 40px 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 14px;
    }
    .footer a { color: var(--accent-light); text-decoration: none; }

    @media (max-width: 640px) {
      .blog-hero h1 { font-size: 2rem; }
      .articles-grid { grid-template-columns: 1fr; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>

  <header class="header">
    <div class="header-inner">
      <a href="https://www.legalsol.pl" class="logo">LEGAL <span>SOLUTIONS</span></a>
      <nav class="nav-links">
        <a href="https://www.legalsol.pl">Home</a>
        <a href="/blog" style="color:white;">Blog</a>
        <a href="https://www.legalsol.pl" class="btn-consult">Free Consultation</a>
      </nav>
    </div>
  </header>

  <section class="blog-hero">
    <h1>Immigration Blog</h1>
    <p>Expert guides, tips, and news about living and working in Poland</p>
  </section>

  ${categories.length > 1 ? `
  <div class="filters">
    <button class="filter-btn active" onclick="filterCategory('')">All</button>
    ${filterHtml}
  </div>` : ""}

  <div class="articles-grid" id="articlesGrid">
    ${articles.length
      ? cardsHtml
      : `<div class="empty-state"><h2>Coming Soon</h2><p>We're preparing expert content for you. Check back soon!</p></div>`
    }
  </div>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} <a href="https://www.legalsol.pl">Legal Solutions</a> &mdash; Immigration Services in Poland</p>
  </footer>

  <script>
    function filterCategory(cat) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.article-card').forEach(card => {
        const cardCat = card.querySelector('.card-category')?.textContent || '';
        card.style.display = (!cat || cardCat === cat) ? '' : 'none';
      });
    }
  </script>

</body>
</html>`;
}

module.exports = async function handler(req, res) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: "Status",
        select: { equals: "Published" }
      },
      sorts: [{ property: "Published Date", direction: "descending" }],
      page_size: 50,
    });

    const articles = response.results.map(page => {
      const props = page.properties;
      return {
        title: getPropertyText(props["Title"]),
        slug: getPropertyText(props["Slug"]),
        category: getPropertyText(props["Category"]),
        language: getPropertyText(props["Language"]),
        seoDescription: getPropertyText(props["SEO Description"]),
        tags: getPropertyText(props["Tags"]),
        coverImage: getPropertyText(props["Cover Image"]),
        publishedDate: getPropertyText(props["Published Date"]),
      };
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderPage(articles));

  } catch (error) {
    console.error("Notion API error:", error);
    res.status(500).send("<h1>Error loading blog</h1><p>Please try again later.</p>");
  }
};
