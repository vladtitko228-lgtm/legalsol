const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_BLOG_DB_ID;

function blocksToHtml(blocks) {
  let html = "";
  let inList = false;
  let listType = "";
  for (const block of blocks) {
    if (inList && block.type !== "bulleted_list_item" && block.type !== "numbered_list_item") {
      html += listType === "ol" ? "</ol>\n" : "</ul>\n";
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
        if (!inList || listType !== "ul") {
          if (inList) html += listType === "ol" ? "</ol>\n" : "</ul>\n";
          html += "<ul>\n"; inList = true; listType = "ul";
        }
        html += `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>\n`;
        break;
      case "numbered_list_item":
        if (!inList || listType !== "ol") {
          if (inList) html += listType === "ol" ? "</ol>\n" : "</ul>\n";
          html += "<ol>\n"; inList = true; listType = "ol";
        }
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
        const imgUrl = block.image.type === "external" ? block.image.external.url : block.image.file.url;
        const caption = block.image.caption?.length ? richTextToHtml(block.image.caption) : "";
        html += `<figure class="article-img"><img src="${imgUrl}" alt="${caption || 'Article image'}" loading="lazy"><figcaption>${caption}</figcaption></figure>\n`;
        break;
      case "callout":
        const icon = block.callout.icon?.emoji || "ð¡";
        html += `<div class="callout"><span class="callout-icon">${icon}</span><div>${richTextToHtml(block.callout.rich_text)}</div></div>\n`;
        break;
      default:
        break;
    }
  }
  if (inList) html += listType === "ol" ? "</ol>\n" : "</ul>\n";
  return html;
}

function richTextToHtml(arr) {
  if (!arr) return "";
  return arr.map(t => {
    let s = esc(t.plain_text);
    if (t.annotations.bold) s = `<strong>${s}</strong>`;
    if (t.annotations.italic) s = `<em>${s}</em>`;
    if (t.annotations.code) s = `<code>${s}</code>`;
    if (t.annotations.strikethrough) s = `<s>${s}</s>`;
    if (t.annotations.underline) s = `<u>${s}</u>`;
    if (t.href) s = `<a href="${t.href}" target="_blank" rel="noopener">${s}</a>`;
    return s;
  }).join("");
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getProp(p) {
  if (!p) return "";
  if (p.type === "title") return p.title?.map(t => t.plain_text).join("") || "";
  if (p.type === "rich_text") return p.rich_text?.map(t => t.plain_text).join("") || "";
  if (p.type === "select") return p.select?.name || "";
  if (p.type === "multi_select") return p.multi_select?.map(s => s.name) || [];
  if (p.type === "date") return p.date?.start || "";
  if (p.type === "files") {
    const f = (p.files || [])[0];
    return f ? (f.type === "external" ? f.external.url : (f.file || {}).url || "") : "";
  }
  return "";
}

function renderPage(a, contentHtml) {
  const { title, seoTitle, seoDescription, category, tags, publishedDate, slug, coverImage, lang } = a;
  const displayTitle = seoTitle || title;
  const canonical = `https://www.legalsol.pl/blog/${slug}`;
  const tagsStr = Array.isArray(tags) ? tags.join(", ") : "";
  const isRu = lang === "RU";
  const otherSlug = slug.endsWith("-en") ? slug.replace(/-en$/, "") : slug + "-en";
  const otherLang = isRu ? "EN" : "RU";
  const otherFlag = isRu ? "ð¬ð§" : "ð·ðº";
  const curFlag = isRu ? "ð·ðº" : "ð¬ð§";

  const heroHtml = coverImage
    ? `<div class="hero-wrap"><img src="${esc(coverImage)}" alt="${esc(title)}" class="hero-img"></div>`
    : "";

  const ogImg = coverImage
    ? `<meta property="og:image" content="${esc(coverImage)}">\n  <meta name="twitter:image" content="${esc(coverImage)}">`
    : "";

  const dateStr = publishedDate
    ? new Date(publishedDate).toLocaleDateString(isRu ? "ru-RU" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return `<!DOCTYPE html>
<html lang="${isRu ? 'ru' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(displayTitle)} | Legal Solutions</title>
  <meta name="description" content="${esc(seoDescription)}">
  <meta name="keywords" content="${esc(tagsStr)}, poland, immigration, legal solutions">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(displayTitle)}">
  <meta property="og:description" content="${esc(seoDescription)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="Legal Solutions">
  ${publishedDate ? `<meta property="article:published_time" content="${publishedDate}">` : ""}
  ${ogImg}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(displayTitle)}">
  <meta name="twitter:description" content="${esc(seoDescription)}">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"${esc(title)}","description":"${esc(seoDescription)}","url":"${canonical}",${coverImage ? `"image":"${esc(coverImage)}",` : ""}"datePublished":"${publishedDate || new Date().toISOString()}","author":{"@type":"Organization","name":"Legal Solutions","url":"https://www.legalsol.pl"},"publisher":{"@type":"Organization","name":"Legal Solutions"}}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    :root {
      --deep: #1E1A4A;
      --primary: #26215C;
      --accent: #534AB7;
      --mid: #7F77DD;
      --light: #CECBF6;
      --bg: #EEEDF8;
      --text: #444;
      --heading: #26215C;
      --white: #fff;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--text); font-family:'Inter',system-ui,sans-serif; line-height:1.7; }

    /* HEADER â matches legalsol.pl */
    .header {
      background: rgba(10,8,28,.75);
      backdrop-filter: blur(30px) saturate(200%);
      -webkit-backdrop-filter: blur(30px) saturate(200%);
      padding: 0 48px;
      height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky; top: 0; z-index: 100;
      border-bottom: 1px solid rgba(139,130,232,.18);
      box-shadow: 0 4px 32px rgba(0,0,0,.4), 0 1px 0 rgba(139,130,232,.1);
    }
    .logo-wrap {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: var(--white); flex-shrink: 0;
    }
    .logo-wrap svg { width: 30px; height: 28px; flex-shrink: 0; }
    .logo-text {
      display: flex; flex-direction: column; line-height: 1.1;
    }
    .logo-name {
      font-family: 'Playfair Display', serif;
      font-weight: 700; font-size: 16px; letter-spacing: 2px;
      color: var(--white);
    }
    .logo-sub {
      font-size: 8px; font-weight: 500; letter-spacing: 3px;
      color: var(--mid);
    }

    .nav-center {
      display: flex; gap: 3px;
      background: rgba(139,130,232,.08); border: 1px solid rgba(139,130,232,.14);
      border-radius: 60px; padding: 4px;
    }
    .nav-center a {
      color: rgba(255,255,255,.58); text-decoration: none;
      font-size: 13px; font-weight: 500; padding: 8px 18px;
      border-radius: 60px; transition: all .25s; white-space: nowrap;
    }
    .nav-center a:hover { background: rgba(139,130,232,.2); color: #fff; }
    .nav-center a.active { background: #5B52CC; color: #fff; box-shadow: 0 2px 10px rgba(91,82,204,.4); }

    .nav-right {
      display: flex; align-items: center; gap: 12px;
    }
    .lang-switch {
      display: flex; align-items: center; gap: 6px;
      background: rgba(91,82,204,.25); border: 1.5px solid rgba(139,130,232,.45);
      padding: 7px 16px; border-radius: 60px;
      color: #B8B2F5; text-decoration: none; font-size: 13px; font-weight: 600;
      transition: all .2s; letter-spacing: 0.5px;
    }
    .lang-switch:hover { background: rgba(91,82,204,.45); border-color: var(--mid); color: #fff; transform: translateY(-1px); }
    .btn-cabinet {
      display: flex; align-items: center; gap: 6px;
      background: rgba(30,27,75,.7); border: 1.5px solid rgba(139,130,232,.45);
      padding: 9px 20px; border-radius: 60px;
      color: #B8B2F5; text-decoration: none; font-size: 13px; font-weight: 500;
      transition: all .2s;
    }
    .btn-cabinet:hover { background: rgba(91,82,204,.35); border-color: var(--mid); color: #fff; transform: translateY(-1px); }

    /* HERO */
    .hero-wrap {
      max-width: 900px; margin: 32px auto 0; padding: 0 24px;
    }
    .hero-img {
      width: 100%; max-height: 420px; object-fit: cover;
      border-radius: 16px; display: block;
      box-shadow: 0 8px 30px rgba(30,26,74,.12);
    }

    /* ARTICLE HEADER */
    .article-header {
      max-width: 780px; margin: 32px auto 0; padding: 0 24px;
    }
    .meta-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
    }
    .cat-badge {
      background: var(--accent); color: #fff;
      padding: 4px 14px; border-radius: 20px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;
    }
    .date-text { color: var(--mid); font-size: 13px; font-weight: 500; }
    .article-header h1 {
      font-size: 2.2rem; font-weight: 800; line-height: 1.2;
      color: var(--heading); margin-bottom: 12px;
    }
    .subtitle {
      color: #666; font-size: 1.05rem; line-height: 1.6;
    }

    /* CONTENT */
    .article-content {
      max-width: 780px; margin: 36px auto; padding: 0 24px;
    }
    .article-content h1 { font-size: 1.8rem; margin: 40px 0 14px; color: var(--heading); font-weight: 700; }
    .article-content h2 { font-size: 1.4rem; margin: 36px 0 12px; color: var(--heading); font-weight: 700; }
    .article-content h3 { font-size: 1.15rem; margin: 28px 0 10px; color: var(--heading); font-weight: 600; }
    .article-content p { margin-bottom: 16px; font-size: 15.5px; line-height: 1.75; color: #444; }
    .article-content ul, .article-content ol { margin: 0 0 16px 24px; }
    .article-content li { margin-bottom: 6px; font-size: 15px; }
    .article-content a { color: var(--accent); text-decoration: underline; }
    .article-content a:hover { color: var(--mid); }
    .article-content strong { color: #333; }

    .article-content blockquote {
      border-left: 4px solid var(--accent);
      padding: 16px 20px;
      margin: 24px 0;
      background: rgba(83,74,183,.06);
      border-radius: 0 12px 12px 0;
      font-size: 15px;
    }
    .article-content blockquote strong { color: var(--heading); }
    .article-content hr {
      border: none; border-top: 1px solid rgba(83,74,183,.15); margin: 32px 0;
    }
    .article-img { margin: 28px 0; }
    .article-img img {
      width: 100%; border-radius: 12px; display: block;
      box-shadow: 0 4px 20px rgba(30,26,74,.08);
    }
    .article-img figcaption {
      color: #999; font-size: 12px; text-align: center; margin-top: 8px;
    }
    .callout {
      display: flex; gap: 12px; align-items: flex-start;
      background: var(--white);
      border: 1px solid rgba(83,74,183,.15);
      border-radius: 12px; padding: 16px 20px; margin: 20px 0;
      box-shadow: 0 2px 8px rgba(30,26,74,.04);
    }
    .callout-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
    .callout div { font-size: 14.5px; line-height: 1.6; }
    .article-content code {
      background: rgba(83,74,183,.08); padding: 2px 6px;
      border-radius: 4px; font-size: 0.88em; color: var(--accent);
    }
    .article-content pre {
      background: var(--primary); color: #e0e0e0;
      padding: 20px; border-radius: 12px; overflow-x: auto; margin: 20px 0;
    }
    .article-content pre code { background: none; padding: 0; color: inherit; }

    /* TAGS */
    .tags-wrap { max-width: 780px; margin: 0 auto; padding: 0 24px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 32px 0; }
    .tag {
      background: var(--light); color: var(--heading);
      padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
    }

    /* CTA BOX */
    .cta-box {
      max-width: 780px; margin: 0 auto 48px; padding: 0 24px;
    }
    .cta-inner {
      background: var(--primary);
      border-radius: 20px; padding: 48px 40px; text-align: center;
      position: relative; overflow: hidden;
    }
    .cta-inner::before {
      content: ''; position: absolute; top: -50%; right: -20%;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(83,74,183,.4), transparent 70%);
      border-radius: 50%;
    }
    .cta-inner h3 {
      font-size: 1.5rem; color: #fff; margin-bottom: 10px; position: relative;
    }
    .cta-inner p {
      color: rgba(255,255,255,.65); margin-bottom: 28px; font-size: 15px; position: relative;
    }
    .cta-btn {
      display: inline-block; position: relative;
      background: var(--accent); color: #fff;
      padding: 14px 36px; border-radius: 30px;
      text-decoration: none; font-weight: 700; font-size: 15px;
      transition: transform .2s, box-shadow .2s;
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(83,74,183,.5);
    }

    /* FLOATING BUTTONS */
    .float-btns {
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 12px; z-index: 99;
    }
    .float-wa {
      width: 56px; height: 56px; border-radius: 50%;
      background: #25D366; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 15px rgba(37,211,102,.4);
      transition: transform .2s;
    }
    .float-wa:hover { transform: scale(1.1); }
    .float-wa svg { width: 28px; height: 28px; fill: #fff; }
    .float-consult {
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #5B52CC, #8B82E8); color: #fff;
      padding: 14px 24px; border-radius: 30px;
      text-decoration: none; font-weight: 700; font-size: 14px;
      box-shadow: 0 4px 20px rgba(83,74,183,.5), 0 0 0 1px rgba(139,130,232,.3);
      transition: transform .2s, box-shadow .2s;
      letter-spacing: 0.3px;
    }
    .float-consult:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(83,74,183,.6); }
    .float-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #22c55e; display: inline-block;
      animation: dotPulse 2s ease-in-out infinite;
    }
    @keyframes dotPulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

    /* FOOTER */
    .footer {
      background: var(--deep); padding: 32px 24px; text-align: center;
      color: rgba(255,255,255,.4); font-size: 13px;
    }
    .footer a { color: var(--mid); text-decoration: none; }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      .header { padding: 0 16px; }
      .nav-center { display: none; }
      .btn-cabinet { display: none; }
      .logo-name { font-size: 20px; letter-spacing: 1.5px; }
      .logo-sub { font-size: 9px; letter-spacing: 2px; }
      .article-header h1 { font-size: 1.7rem; }
      .hero-img { max-height: 260px; }
      .cta-inner { padding: 32px 24px; }
      .float-consult { padding: 12px 18px; font-size: 12px; }
    }
  </style>
</head>
<body>

  <header class="header">
    <a href="https://www.legalsol.pl" class="logo-wrap">
      <svg viewBox="0 0 34 32" fill="none"><rect x="0" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="9" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="18" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="27" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="0" y="5" width="34" height="4" rx="2" fill="#5B52CC"/><rect x="0" y="29" width="34" height="3" rx="1.5" fill="#5B52CC"/></svg>
      <div class="logo-text">
        <div class="logo-name">LEGAL SOLUTIONS</div>
        <div class="logo-sub">LEGALIZATION SERVICES</div>
      </div>
    </a>
    <nav class="nav-center">
      <a href="https://www.legalsol.pl">Home</a>
      <a href="https://www.legalsol.pl#tab-services">Services</a>
      <a href="https://www.legalsol.pl#tab-work">Work</a>
      <a href="https://www.legalsol.pl#tab-blog" class="active">Blog</a>
      <a href="https://www.legalsol.pl#tab-ai">AI</a>
    </nav>
    <div class="nav-right">
      <a href="/blog/${otherSlug}" class="lang-switch">${otherFlag} ${otherLang}</a>
      <a href="https://www.legalsol.pl#tab-cabinet" class="btn-cabinet">ð¤ Cabinet</a>
    </div>
  </header>

  <article>
    ${heroHtml}

    <div class="article-header">
      <div class="meta-row">
        ${category ? `<span class="cat-badge">${esc(category)}</span>` : ""}
        ${dateStr ? `<span class="date-text">${dateStr}</span>` : ""}
      </div>
      <h1>${esc(title)}</h1>
      <p class="subtitle">${esc(seoDescription)}</p>
    </div>

    <div class="article-content">
      ${contentHtml}
    </div>

    ${tags && tags.length ? `
    <div class="tags-wrap">
      <div class="tags">
        ${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join("\n        ")}
      </div>
    </div>` : ""}
  </article>

  <div class="cta-box">
    <div class="cta-inner">
      <h3>${isRu ? "ÐÑÐ¶Ð½Ð° Ð¿Ð¾Ð¼Ð¾ÑÑ Ñ Ð»ÐµÐ³Ð°Ð»Ð¸Ð·Ð°ÑÐ¸ÐµÐ¹?" : "Need Help with Immigration?"}</h3>
      <p>${isRu ? "Legal Solutions â Ð¾Ñ ÐºÐ¾Ð½ÑÑÐ»ÑÑÐ°ÑÐ¸Ð¸ Ð´Ð¾ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° Ð² ÑÑÐºÐ°Ñ. 3 000+ ÑÑÐ¿ÐµÑÐ½ÑÑ Ð´ÐµÐ», 98% Ð¾Ð´Ð¾Ð±ÑÐµÐ½Ð¸Ð¹." : "Legal Solutions handles everything from consultation to document in hand. 3,000+ successful cases, 98% approval rate."}</p>
      <a href="https://www.legalsol.pl" class="cta-btn">${isRu ? "ÐÐµÑÐ¿Ð»Ð°ÑÐ½Ð°Ñ ÐºÐ¾Ð½ÑÑÐ»ÑÑÐ°ÑÐ¸Ñ â" : "Free Consultation â"}</a>
    </div>
  </div>

  <div class="float-btns">
    <a href="https://wa.me/48123456789" class="float-wa" target="_blank">
      <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>
    <a href="https://www.legalsol.pl" class="float-consult">
      <span class="float-dot"></span>
      <span class="fc-text">${isRu ? "ÐÐ¾Ð½ÑÑÐ»ÑÑÐ°ÑÐ¸Ñ" : "Free Consultation"}</span>
    </a>
  </div>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} <a href="https://www.legalsol.pl">Legal Solutions</a> â Immigration Services in Poland</p>
  </footer>

</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) { res.status(400).send("Missing slug"); return; }

  try {
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
    const propCover = getProp(props["Cover Image"]);
    const pageCover = page.cover
      ? (page.cover.type === "external" ? page.cover.external.url : (page.cover.file || {}).url || "")
      : "";

    const article = {
      title: getProp(props["Title"]),
      slug: getProp(props["Slug"]),
      seoTitle: getProp(props["SEO Title"]),
      seoDescription: getProp(props["SEO Description"]),
      category: getProp(props["Category"]),
      tags: getProp(props["Tags"]),
      publishedDate: getProp(props["Published Date"]),
      coverImage: propCover || pageCover || "",
      lang: getProp(props["Language"]) || "EN",
    };

    const blocks = await notion.blocks.children.list({ block_id: page.id, page_size: 100 });
    const contentHtml = blocksToHtml(blocks.results);

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
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Article Not Found | Legal Solutions</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
<style>body{background:#EEEDF8;color:#26215C;font-family:'Inter',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;text-align:center}
h1{font-size:4rem;margin-bottom:8px;color:#534AB7}p{color:#666;margin-bottom:24px;font-size:16px}
a{color:#fff;background:#534AB7;padding:12px 28px;border-radius:30px;text-decoration:none;font-weight:600;transition:all .2s}
a:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(83,74,183,.3)}</style>
</head><body><h1>404</h1><p>Article not found</p><a href="https://www.legalsol.pl">Back to Legal Solutions</a></body></html>`;
}
