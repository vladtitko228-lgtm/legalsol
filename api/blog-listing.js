// ============================================================
// Vercel Serverless Function  -  Blog Listing Page
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

const FALLBACK_IMAGES = {
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

function getFallback(category) {
  return FALLBACK_IMAGES[(category || "").toUpperCase()] || FALLBACK_IMAGES["DEFAULT"];
}

function renderArticleCard(article) {
  const dateStr = article.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const fallback = getFallback(article.category);
  // Replace expired Notion S3 URLs with permanent fallback
  const imgSrc = (!article.coverImage || article.coverImage.includes('s3.amazonaws.com') || article.coverImage.includes('prod-files-secure') || article.coverImage.includes('secure.notion-static'))
      ? fallback
      : article.coverImage;
  const coverHtml = `<div class="card-cover"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(article.title||article.category||'Article')}" loading="lazy" style="width:100%;height:200px;object-fit:cover;display:block;" onerror="this.src='${fallback}';this.onerror=null;"></div>`;

  const tagsArr = Array.isArray(article.tags) ? article.tags : [];
  const tagsHtml = tagsArr.length
    ? tagsArr.slice(0, 10).map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join("")
    : "";
  const tagsStr = tagsArr.join(" ");

  return `
    <a href="/blog/${escapeHtml(article.slug)}" class="article-card" data-title="${escapeHtml(article.title)}" data-desc="${escapeHtml(article.seoDescription)}" data-cat="${escapeHtml(article.category)}" data-tags="${escapeHtml(tagsStr)}">
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
  <title>Blog - Legal Solutions | Immigration Guides for Poland</title>
  <meta name="description" content="Expert guides on immigration to Poland: karta pobytu, work permits, PESEL, business registration, and more. Free resources from Legal Solutions.">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="canonical" href="https://www.legalsol.pl/blog">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog - Legal Solutions">
  <meta property="og:description" content="Expert immigration guides for Poland">
  <meta property="og:url" content="https://www.legalsol.pl/blog">
  <meta property="og:image" content="https://www.legalsol.pl/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Blog - Legal Solutions | Immigration Guides">
  <meta name="twitter:description" content="Expert immigration guides for Poland: karta pobytu, work permits, PESEL and more.">
  <meta name="twitter:image" content="https://www.legalsol.pl/og-image.jpg">
  <link rel="alternate" hreflang="en" href="https://www.legalsol.pl/blog">
  <link rel="alternate" hreflang="x-default" href="https://www.legalsol.pl/blog">

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

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    :root {
      --p900:#1E1B4B;--p800:#2D2869;--p700:#3D3585;--p500:#5B52CC;--p400:#8B82E8;--p300:#B8B2F5;--p200:#DAD7FF;
      --rb:60px;--txt2:rgba(255,255,255,.58);
      --bg:#0d0d2b;--card-bg:#141432;--text:#e0e0e0;--text-muted:#9090b0;
      --accent:#5B52CC;--accent-light:#B8B2F5;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      padding-top: 68px;
    }

    /* NAV */
    nav {
      position:fixed;top:0;left:0;right:0;z-index:500;
      padding:0 48px;height:68px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      background:rgba(10,8,28,.85);
      backdrop-filter:blur(30px) saturate(200%);
      -webkit-backdrop-filter:blur(30px) saturate(200%);
      border-bottom:1px solid rgba(139,130,232,.18);
      box-shadow:0 4px 32px rgba(0,0,0,.4);
    }
    .logo { display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0; }
    .logo-name { font-family:'Playfair Display',serif;font-size:16px;font-weight:700;letter-spacing:2px;color:#fff; }
    .logo-sub { font-size:8px;letter-spacing:3px;color:var(--p400); }
    .tab-nav {
      display:flex;gap:3px;
      background:rgba(139,130,232,.08);border:1px solid rgba(139,130,232,.14);
      border-radius:var(--rb);padding:4px;margin-left:40px;
    }
    .tab-btn {
      background:none;border:none;padding:8px 18px;border-radius:var(--rb);
      font-size:13px;font-weight:500;cursor:pointer;
      font-family:'Inter',sans-serif;color:var(--txt2);
      transition:all .25s;white-space:nowrap;text-decoration:none;display:inline-block;
    }
    .tab-btn.active { background:var(--p500);color:#fff;box-shadow:0 2px 10px rgba(91,82,204,.4); }
    .tab-btn:hover:not(.active) { background:rgba(139,130,232,.2);color:#fff; }
    .tab-btn.referral-btn {
      background:linear-gradient(135deg,rgba(250,204,21,.15),rgba(234,179,8,.08));
      border:1px solid rgba(250,204,21,.25);color:#fde047;position:relative;overflow:hidden;
    }
    .tab-btn.referral-btn .shimmer {
      position:absolute;inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
      animation:heroRefShimmer 3s ease-in-out infinite;pointer-events:none;
    }
    @keyframes heroRefShimmer{0%{transform:translateX(-100%)}50%,100%{transform:translateX(100%)}}
    .gift-icon{display:inline-block;margin-right:5px;}
    .nav-right { display:flex;align-items:center;gap:10px;flex-shrink:0; }
    .lang-dd{position:relative;z-index:9999;}
    .lang-dd-trigger{display:flex;align-items:center;gap:7px;background:rgba(139,130,232,.1);border:1px solid rgba(139,130,232,.22);border-radius:60px;padding:6px 12px 6px 8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;color:rgba(255,255,255,.85);transition:all .2s;}
    .lang-dd-trigger:hover{background:rgba(91,82,204,.25);color:#fff;}
    .lang-dd-trigger .arrow{transition:transform .25s;opacity:.5;}
    .lang-dd.open .arrow{transform:rotate(180deg);}
    .lang-dd-panel{position:absolute;top:calc(100% + 8px);right:0;background:rgba(12,10,36,.97);border:1px solid rgba(139,130,232,.22);border-radius:16px;padding:6px;display:none;flex-direction:column;gap:1px;min-width:120px;box-shadow:0 24px 60px rgba(0,0,0,.7);backdrop-filter:blur(20px);z-index:99999;}
    .lang-dd.open .lang-dd-panel{display:flex;}
    .ldp-btn{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;padding:8px 12px;border-radius:10px;cursor:pointer;color:rgba(255,255,255,.75);font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .15s;text-decoration:none;}
    .ldp-btn:hover{background:rgba(91,82,204,.25);color:#fff;}
    .lang-flag{border-radius:2px;flex-shrink:0;display:block;}
    .nav-cab-btn {
      background:rgba(30,27,75,.7);border:1.5px solid rgba(139,130,232,.45);
      color:#B8B2F5;padding:9px 20px;border-radius:var(--rb);
      font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;
      display:flex;align-items:center;gap:6px;text-decoration:none;transition:all .2s;
    }
    .nav-cab-btn:hover{background:rgba(91,82,204,.35);color:#fff;}
    .mob-burger{display:none;background:none;border:none;cursor:pointer;padding:6px;flex-direction:column;gap:5px;width:32px;}
    .mob-burger span{display:block;width:20px;height:2px;background:#fff;border-radius:2px;}
    #mob-nav{display:none;position:fixed;top:68px;left:0;right:0;background:rgba(10,8,28,.97);border-bottom:1px solid rgba(139,130,232,.18);padding:12px;z-index:499;flex-direction:column;gap:4px;}
    #mob-nav.open{display:flex;}
    .mob-nav-btn{padding:12px 16px;border-radius:12px;color:rgba(255,255,255,.7);text-decoration:none;font-size:14px;font-weight:500;transition:background .2s;}
    .mob-nav-btn:hover,.mob-nav-active{background:rgba(91,82,204,.2);color:#fff;}

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

    /* Search */
    .search-wrap { max-width:320px; margin:0 auto 28px; padding:0 24px; position:relative; transition:max-width .4s cubic-bezier(.4,0,.2,1); }
    .search-wrap:focus-within { max-width:540px; }
    .search-input { width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(124,92,252,.2); border-radius:30px; padding:9px 40px 9px 38px; color:#fff; font-size:13px; outline:none; font-family:inherit; transition:border-color .25s,background .25s,box-shadow .3s; }
    .search-input:focus { border-color:rgba(124,92,252,.65); background:rgba(255,255,255,.09); box-shadow:0 0 22px rgba(124,92,252,.18); }
    .search-input::placeholder { color:rgba(255,255,255,.28); }
    .search-icon { position:absolute; left:36px; top:50%; transform:translateY(-50%); opacity:.35; pointer-events:none; }
    .search-clear { position:absolute; right:34px; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(255,255,255,.5); cursor:pointer; font-size:18px; display:none; line-height:1; padding:4px 6px; }
    #no-results { display:none; text-align:center; padding:60px 24px; color:rgba(255,255,255,.4); font-size:16px; grid-column:1/-1; }

    @media (max-width: 960px) {
      nav { padding:0 14px 0 12px; height:60px; }
      body { padding-top: 60px; }
      .tab-nav,.nav-cab-btn { display:none; }
      .mob-burger { display:flex; }
      #mob-nav { top:60px; }
    }
    @media (max-width: 640px) {
      .blog-hero h1 { font-size: 2rem; }
      .articles-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <nav>
    <a class="logo" href="https://www.legalsol.pl">
      <svg width="30" height="28" viewBox="0 0 34 32"><rect x="0" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="9" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="18" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="27" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="0" y="5" width="34" height="4" rx="2" fill="#5B52CC"/><rect x="0" y="29" width="34" height="3" rx="1.5" fill="#5B52CC"/></svg>
      <div><div class="logo-name">LEGAL SOLUTIONS</div><div class="logo-sub">LEGALIZATION SERVICES</div></div>
    </a>
    <div class="tab-nav">
      <a class="tab-btn" href="https://www.legalsol.pl">Home</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-services">Services</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-jobs">Work</a>
      <a class="tab-btn active" href="/blog">Blog</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-ai">AI</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-status">Check Status</a>
      <a class="tab-btn referral-btn" href="https://www.legalsol.pl#tab-referral"><span class="shimmer"></span><span class="gift-icon">🎁</span>Refer a Friend</a>
    </div>
    <div class="nav-right">
      <div class="lang-dd" id="lang-dd">
        <button class="lang-dd-trigger" onclick="document.getElementById('lang-dd').classList.toggle('open');event.stopPropagation();">
          <svg width="24" height="16" viewBox="0 0 60 30" style="border-radius:2px;vertical-align:middle"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>
          <span>EN</span>
          <svg class="arrow" width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="lang-dd-panel">
          <a class="ldp-btn active" href="/blog"><svg width="20" height="14" viewBox="0 0 60 30" style="border-radius:2px;vertical-align:middle"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg><span>EN</span></a>
          <a class="ldp-btn" href="/blog"><svg width="20" height="14" viewBox="0 0 9 6" style="border-radius:2px;vertical-align:middle"><rect width="9" height="2" fill="#fff"/><rect y="2" width="9" height="2" fill="#0039A6"/><rect y="4" width="9" height="2" fill="#D52B1E"/></svg><span>RU</span></a>
        </div>
      </div>
      <a href="https://www.legalsol.pl#tab-cabinet" class="nav-cab-btn">👤 Cabinet</a>
      <button class="mob-burger" onclick="document.getElementById('mob-nav').classList.toggle('open');" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </nav>

  <div id="mob-nav">
    <a class="mob-nav-btn" href="https://www.legalsol.pl">Home</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-services">Services</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-jobs">Work</a>
    <a class="mob-nav-btn mob-nav-active" href="/blog">Blog</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-ai">AI</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-status">Check Status</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-referral" style="color:#fde047;">🎁 Refer a Friend</a>
  </div>

  <section class="blog-hero">
    <h1>Immigration Blog</h1>
    <p>Expert guides, tips, and news about living and working in Poland</p>
  </section>

  <div class="search-wrap">
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input class="search-input" id="searchInput" type="text" placeholder="Search articles... / Поиск статей..." oninput="handleSearch(this.value)" autocomplete="off">
    <button class="search-clear" id="searchClear" onclick="clearSearch()" title="Clear">×</button>
  </div>

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
    <div id="no-results">No articles found</div>
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
    function handleSearch(val) {
      var q = val.trim().toLowerCase();
      var cards = document.querySelectorAll('.article-card');
      var visible = 0;
      document.getElementById('searchClear').style.display = q ? 'block' : 'none';
      document.querySelector('.filters') && (document.querySelector('.filters').style.display = q ? 'none' : '');
      cards.forEach(function(c) {
        var text = ((c.dataset.title||'') + ' ' + (c.dataset.desc||'') + ' ' + (c.dataset.cat||'') + ' ' + (c.dataset.tags||'')).toLowerCase();
        var show = !q || text.includes(q);
        c.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('no-results').style.display = (q && visible === 0) ? 'block' : 'none';
    }
    function clearSearch() {
      document.getElementById('searchInput').value = '';
      handleSearch('');
    }
    document.addEventListener('click', function(e) {
      var dd = document.getElementById('lang-dd');
      if (dd && !dd.contains(e.target)) dd.classList.remove('open');
    });
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
      page_size: 100,
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

    // Show only EN posts in the public feed
    const filtered = articles.filter(a => a.language === "EN");

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=120");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderPage(filtered));

  } catch (error) {
    console.error("Notion API error:", error);
    res.status(500).send("<h1>Error loading blog</h1><p>Please try again later.</p>");
  }
};
