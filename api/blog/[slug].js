// ============================================================
// Vercel Serverless Function â Blog Article Page
// Fetches article from Notion by slug, returns full HTML
// Route: /blog/[slug]  (via vercel.json rewrite)
// ============================================================

const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_BLOG_DB_ID; // b5fc50d974b54a22bea514a8b65af26d

// Convert Notion blocks to HTML
function blocksToHtml(blocks) {
  let html = "";
  let inList = false;

  for (const block of blocks) {
    // Close list if current block is not a list item
    if (inList && block.type !== "bulleted_list_item" && block.type !== "numbered_list_item") {
      html += "</ul>\n";
      inList = false;
    }

    switch (block.type) {
      case "paragraph":
        const text = richTextToHtml(block.paragraph.rich_text);
        if (text) html += `<p>${text}</p>\n`;
        break;

      case "heading_1":
        html += `<h1>${richTextToHtml(block.heading_1.rich_text)}</h1>\n`;
        break;

      case "heading_2":
        html += `<h2>${richTextToHtml(block.heading_2.rich_text)}</h2>\n`;
        break;

      case "heading_3":
        html += `<h3>${richTextToHtml(block.heading_3.rich_text)}</h3>\n`;
        break;

      case "bulleted_list_item":
        if (!inList) { html += "<ul>\n"; inList = true; }
        html += `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>\n`;
        break;

      case "numbered_list_item":
        if (!inList) { html += "<ol>\n"; inList = true; }
        html += `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>\n`;
        break;

      case "divider":
        html += "<hr>\n";
        break;

      case "quote":
        html += `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>\n`;
        break;

      case "code":
        html += `<pre><code>${richTextToHtml(block.code.rich_text)}</code></pre>\n`;
        break;

      case "image":
        const imgUrl = block.image.type === "external"
          ? block.image.external.url
          : block.image.file.url;
        const caption = block.image.caption?.length
          ? richTextToHtml(block.image.caption)
          : "";
        html += `<figure><img src="${imgUrl}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>\n`;
        break;

      case "callout":
        const icon = block.callout.icon?.emoji || "";
        html += `<div class="callout">${icon} ${richTextToHtml(block.callout.rich_text)}</div>\n`;
        break;

      default:
        break;
    }
  }

  if (inList) html += "</ul>\n";
  return html;
}

function richTextToHtml(richTextArr) {
  if (!richTextArr) return "";
  return richTextArr.map(t => {
    let text = escapeHtml(t.plain_text);
    if (t.annotations.bold) text = `<strong>${text}</strong>`;
    if (t.annotations.italic) text = `<em>${text}</em>`;
    if (t.annotations.code) text = `<code>${text}</code>`;
    if (t.annotations.strikethrough) text = `<s>${text}</s>`;
    if (t.annotations.underline) text = `<u>${text}</u>`;
    if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join("");
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getPropertyText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "multi_select") return prop.multi_select?.map(s => s.name) || [];
  if (prop.type === "date") return prop.date?.start || "";
  return "";
}

// Full HTML page template with SEO
function renderPage(article, contentHtml) {
  const { title, seoTitle, seoDescription, category, tags, publishedDate, slug } = article;
  const displayTitle = seoTitle || title;
  const canonical = `https://www.legalsol.pl/blog/${slug}`;
  const tagsStr = Array.isArray(tags) ? tags.join(", ") : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(displayTitle)} | Legal Solutions</title>
  <meta name="description" content="${escapeHtml(seoDescription)}">
  <meta name="keywords" content="${escapeHtml(tagsStr)}, poland, immigration, legal solutions">
  <link rel="canonical" href="${canonical}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(displayTitle)}">
  <meta property="og:description" content="${escapeHtml(seoDescription)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="Legal Solutions">
  ${publishedDate ? `<meta property="article:published_time" content="${publishedDate}">` : ""}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(displayTitle)}">
  <meta name="twitter:description" content="${escapeHtml(seoDescription)}">

  <!-- Schema.org Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${escapeHtml(title)}",
    "description": "${escapeHtml(seoDescription)}",
    "url": "${canonical}",
    "datePublished": "${publishedDate || new Date().toISOString()}",
    "author": { "@type": "Organization", "name": "Legal Solutions", "url": "https://www.legalsol.pl" },
    "publisher": { "@type": "Organization", "name": "Legal Solutions" }
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
      --green: #22c55e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.7;
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
      transition: opacity 0.2s;
    }
    .btn-consult:hover { opacity: 0.9; }

    /* Article */
    .article-hero {
      max-width: 800px;
      margin: 60px auto 0;
      padding: 0 24px;
    }
    .article-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .category-badge {
      background: rgba(124,92,252,0.15);
      color: var(--accent-light);
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .date { color: var(--text-muted); font-size: 14px; }
    .article-hero h1 {
      font-size: 2.4rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #fff, var(--accent-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .article-hero .subtitle {
      color: var(--text-muted);
      font-size: 1.15rem;
      line-height: 1.6;
    }

    /* Content */
    .article-content {
      max-width: 800px;
      margin: 40px auto;
      padding: 0 24px;
    }
    .article-content h1 { font-size: 2rem; margin: 48px 0 16px; color: white; }
    .article-content h2 { font-size: 1.5rem; margin: 40px 0 14px; color: white; }
    .article-content h3 { font-size: 1.2rem; margin: 32px 0 12px; color: white; }
    .article-content p { margin-bottom: 18px; color: var(--text); }
    .article-content ul, .article-content ol { margin: 0 0 18px 24px; }
    .article-content li { margin-bottom: 8px; }
    .article-content a { color: var(--accent-light); text-decoration: underline; }
    .article-content blockquote {
      border-left: 3px solid var(--accent);
      padding: 12px 20px;
      margin: 20px 0;
      background: rgba(124,92,252,0.05);
      border-radius: 0 8px 8px 0;
    }
    .article-content hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 32px 0;
    }
    .article-content img {
      max-width: 100%;
      border-radius: 12px;
      margin: 20px 0;
    }
    .article-content figure { margin: 24px 0; }
    .article-content figcaption { color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 8px; }
    .article-content .callout {
      background: var(--card-bg);
      border: 1px solid rgba(124,92,252,0.2);
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .article-content code {
      background: rgba(124,92,252,0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .article-content pre {
      background: var(--card-bg);
      padding: 20px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 20px 0;
    }
    .article-content pre code { background: none; padding: 0; }

    /* Tags */
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 40px 0; }
    .tag {
      background: rgba(124,92,252,0.1);
      color: var(--accent-light);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
    }

    /* CTA */
    .cta-box {
      max-width: 800px;
      margin: 0 auto 60px;
      padding: 0 24px;
    }
    .cta-inner {
      background: linear-gradient(135deg, var(--card-bg), rgba(124,92,252,0.1));
      border: 1px solid rgba(124,92,252,0.3);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
    }
    .cta-inner h3 { font-size: 1.5rem; margin-bottom: 12px; color: white; }
    .cta-inner p { color: var(--text-muted); margin-bottom: 24px; }
    .cta-btn {
      display: inline-block;
      background: var(--accent);
      color: white;
      padding: 14px 36px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124,92,252,0.4); }

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

    /* Responsive */
    @media (max-width: 640px) {
      .article-hero h1 { font-size: 1.8rem; }
      .nav-links { display: none; }
      .cta-inner { padding: 28px 20px; }
    }
  </style>
</head>
<body>

  <header class="header">
    <div class="header-inner">
      <a href="https://www.legalsol.pl" class="logo">LEGAL <span>SOLUTIONS</span></a>
      <nav class="nav-links">
        <a href="https://www.legalsol.pl">Home</a>
        <a href="https://www.legalsol.pl/blog">Blog</a>
        <a href="https://www.legalsol.pl" class="btn-consult">Free Consultation</a>
      </nav>
    </div>
  </header>

  <article>
    <div class="article-hero">
      <div class="article-meta">
        ${category ? `<span class="category-badge">${escapeHtml(category)}</span>` : ""}
        ${publishedDate ? `<span class="date">${new Date(publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>` : ""}
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(seoDescription)}</p>
    </div>

    <div class="article-content">
      ${contentHtml}
    </div>

    ${tags && tags.length ? `
    <div class="article-content">
      <div class="tags">
        ${tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join("\n        ")}
      </div>
    </div>` : ""}
  </article>

  <div class="cta-box">
    <div class="cta-inner">
      <h3>Need Help with Immigration?</h3>
      <p>Legal Solutions handles everything from consultation to document submission. 3,000+ successful cases, 98% approval rate.</p>
      <a href="https://www.legalsol.pl" class="cta-btn">Book Free Consultation</a>
    </div>
  </div>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} <a href="https://www.legalsol.pl">Legal Solutions</a> &mdash; Immigration Services in Poland</p>
  </footer>

</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    res.status(400).send("Missing slug");
    return;
  }

  try {
    // Query Notion for article with matching slug
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: "Slug", rich_text: { equals: slug } },
          { property: "Status", select: { equals: "Published" } }
        ]
      }
    });

    if (!response.results.length) {
      res.status(404).send(renderNotFound(slug));
      return;
    }

    const page = response.results[0];
    const props = page.properties;

    const article = {
      title: getPropertyText(props["Title"]),
      slug: getPropertyText(props["Slug"]),
      seoTitle: getPropertyText(props["SEO Title"]),
      seoDescription: getPropertyText(props["SEO Description"]),
      category: getPropertyText(props["Category"]),
      tags: getPropertyText(props["Tags"]),
      publishedDate: getPropertyText(props["Published Date"]),
    };

    // Fetch page content blocks
    const blocks = await notion.blocks.children.list({ block_id: page.id, page_size: 100 });
    const contentHtml = blocksToHtml(blocks.results);

    // Cache for 10 minutes, stale-while-revalidate for 1 hour
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderPage(article, contentHtml));

  } catch (error) {
    console.error("Notion API error:", error);
    res.status(500).send("Internal server error");
  }
};

function renderNotFound(slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Not Found | Legal Solutions</title>
  <style>
    body { background: #0d0d2b; color: #e0e0e0; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .box { text-align: center; }
    h1 { font-size: 3rem; margin-bottom: 12px; }
    p { color: #9090b0; margin-bottom: 24px; }
    a { color: #7c5cfc; text-decoration: none; padding: 12px 28px; border: 2px solid #7c5cfc; border-radius: 30px; transition: all 0.2s; }
    a:hover { background: #7c5cfc; color: white; }
  </style>
</head>
<body>
  <div class="box">
    <h1>404</h1>
    <p>Article not found</p>
    <a href="https://www.legalsol.pl">Back to Legal Solutions</a>
  </div>
</body>
</html>`;
}
