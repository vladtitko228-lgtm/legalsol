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
        const icon = block.callout.icon?.emoji || "\u{1F4A1}";
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

  const heroHtml = coverImage
    ? `<div class="hero-wrap"><img src="${esc(coverImage)}" alt="${esc(title)}" class="hero-img"></div>`
    : "";

  const ogImg = coverImage
    ? `<meta property="og:image" content="${esc(coverImage)}">\n  <meta name="twitter:image" content="${esc(coverImage)}">`
    : "";

  const dateStr = publishedDate
    ? new Date(publishedDate).toLocaleDateString(isRu ? "ru-RU" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  // i18n strings
  const t = isRu ? {
    home: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F",
    services: "\u041D\u0430\u0448\u0438 \u0443\u0441\u043B\u0443\u0433\u0438",
    work: "\u0420\u0430\u0431\u043E\u0442\u0430",
    blog: "\u0411\u043B\u043E\u0433",
    ai: "\u0418\u0418",
    checkStatus: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441",
    referFriend: "\u041F\u0440\u0438\u0432\u0435\u0434\u0438 \u0434\u0440\u0443\u0433\u0430",
    cabinet: "\u041A\u0430\u0431\u0438\u043D\u0435\u0442",
    ctaTitle: "\u041D\u0443\u0436\u043D\u0430 \u043F\u043E\u043C\u043E\u0449\u044C \u0441 \u043B\u0435\u0433\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0435\u0439?",
    ctaDesc: "Legal Solutions \u2014 \u043E\u0442 \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u0438 \u0434\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 \u0432 \u0440\u0443\u043A\u0430\u0445. 3 000+ \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0445 \u0434\u0435\u043B, 98% \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u0439.",
    ctaBtn: "\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430\u044F \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F \u2192",
    consultation: "\u041A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F",
    footerText: "\u0418\u043C\u043C\u0438\u0433\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0443\u0441\u043B\u0443\u0433\u0438 \u0432 \u041F\u043E\u043B\u044C\u0448\u0435"
  } : {
    home: "Home",
    services: "Services",
    work: "Work",
    blog: "Blog",
    ai: "AI",
    checkStatus: "Check Status",
    referFriend: "Refer a Friend",
    cabinet: "Cabinet",
    ctaTitle: "Need Help with Immigration?",
    ctaDesc: "Legal Solutions handles everything from consultation to document in hand. 3,000+ successful cases, 98% approval rate.",
    ctaBtn: "Free Consultation \u2192",
    consultation: "Free Consultation",
    footerText: "Immigration Services in Poland"
  };

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
      --p900:#1E1B4B;--p800:#2D2869;--p700:#3D3585;--p500:#5B52CC;--p400:#8B82E8;--p300:#B8B2F5;--p200:#DAD7FF;
      --rb:60px;
      --txt:rgba(255,255,255,.88);--txt2:rgba(255,255,255,.58);--txt3:rgba(255,255,255,.34);
      --bg:#EEEDF8;--heading:#26215C;--text:#444;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--text); font-family:'Inter',system-ui,sans-serif; line-height:1.7; }

    /* === NAV — 1:1 copy from legalsol.pl === */
    nav {
      position:fixed;top:0;left:0;right:0;z-index:500;
      padding:0 48px;height:68px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      background:rgba(10,8,28,.75);
      backdrop-filter:blur(30px) saturate(200%);
      -webkit-backdrop-filter:blur(30px) saturate(200%);
      border-bottom:1px solid rgba(139,130,232,.18);
      box-shadow:0 4px 32px rgba(0,0,0,.4),0 1px 0 rgba(139,130,232,.1);
    }
    .logo {
      display:flex;align-items:center;gap:10px;
      text-decoration:none;flex-shrink:0;
    }
    .logo-name {
      font-family:'Playfair Display',serif;font-size:16px;
      font-weight:700;letter-spacing:2px;color:#fff;
    }
    .logo-sub {
      font-size:8px;letter-spacing:3px;color:var(--p400);
    }
    .tab-nav {
      display:flex;gap:3px;
      background:rgba(139,130,232,.08);border:1px solid rgba(139,130,232,.14);
      border-radius:var(--rb);padding:4px;
      margin-left:40px;
    }
    .tab-btn {
      background:none;border:none;
      padding:8px 18px;border-radius:var(--rb);
      font-size:13px;font-weight:500;cursor:pointer;
      font-family:'Inter',sans-serif;color:var(--txt2);
      transition:all .25s;white-space:nowrap;
      text-decoration:none;display:inline-block;
    }
    .tab-btn.active { background:var(--p500);color:#fff;box-shadow:0 2px 10px rgba(91,82,204,.4); }
    .tab-btn:hover:not(.active) { background:rgba(139,130,232,.2);color:#fff; }
    .tab-btn.referral-btn {
      background:linear-gradient(135deg,rgba(250,204,21,.15),rgba(234,179,8,.08));
      border:1px solid rgba(250,204,21,.25);color:#fde047;
      position:relative;overflow:hidden;
    }
    .tab-btn.referral-btn .shimmer {
      position:absolute;inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
      animation:heroRefShimmer 3s ease-in-out infinite;pointer-events:none;
    }
    @keyframes heroRefShimmer{0%{transform:translateX(-100%)}50%,100%{transform:translateX(100%)}}
    .gift-icon{display:inline-block;margin-right:5px;animation:giftBounce 2s ease-in-out infinite;}
    @keyframes giftBounce{0%,100%{transform:translateY(0) rotate(0deg);}30%{transform:translateY(-4px) rotate(-8deg);}60%{transform:translateY(-2px) rotate(5deg);}}
    .nav-right {
      display:flex;align-items:center;gap:10px;flex-shrink:0;
    }
    /* Language dropdown — matches main site */
    .lang-dd{position:relative;z-index:9999;}
    .lang-dd-trigger{display:flex;align-items:center;gap:7px;background:rgba(139,130,232,.1);border:1px solid rgba(139,130,232,.22);border-radius:60px;padding:6px 12px 6px 8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;color:rgba(255,255,255,.85);transition:all .2s;letter-spacing:.5px;}
    .lang-dd-trigger:hover{background:rgba(91,82,204,.25);border-color:var(--p400);color:#fff;}
    .lang-dd-trigger .arrow{transition:transform .25s;opacity:.5;flex-shrink:0;}
    .lang-dd.open .arrow{transform:rotate(180deg);}
    .lang-dd-panel{position:absolute;top:calc(100% + 8px);right:0;background:rgba(12,10,36,.97);border:1px solid rgba(139,130,232,.22);border-radius:16px;padding:6px;display:none;flex-direction:column;gap:1px;min-width:158px;box-shadow:0 24px 60px rgba(0,0,0,.7);backdrop-filter:blur(20px);z-index:99999;}
    .lang-dd.open .lang-dd-panel{display:flex;animation:ldSlide .2s cubic-bezier(.34,1.2,.64,1);}
    @keyframes ldSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    .ldp-btn{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;padding:8px 12px;border-radius:10px;cursor:pointer;color:rgba(255,255,255,.75);font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .15s;}
    .ldp-btn:hover{background:rgba(91,82,204,.25);color:#fff;}
    .ldp-btn.active{background:rgba(91,82,204,.35);color:#fff;}
    .lang-flag{border-radius:2px;flex-shrink:0;object-fit:cover;}
    .ldp-code{font-weight:700;min-width:22px;}
    .ldp-name{color:rgba(255,255,255,.45);font-weight:400;margin-left:auto;}
    /* Cabinet button — matches main site */
    .nav-cab-btn {
      background:rgba(30,27,75,.7);border:1.5px solid rgba(139,130,232,.45);
      color:#B8B2F5;padding:9px 20px;border-radius:var(--rb);
      font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;
      display:flex;align-items:center;gap:6px;
      text-decoration:none;transition:all .2s;
    }
    .nav-cab-btn:hover{background:rgba(91,82,204,.35);border-color:var(--p400);color:#fff;transform:translateY(-1px);}
    /* Burger */
    .mob-burger{display:none;background:none;border:none;cursor:pointer;padding:6px;flex-direction:column;gap:5px;width:32px;}
    .mob-burger span{display:block;width:20px;height:2px;background:#fff;border-radius:2px;transition:all .3s;}

    /* HERO */
    .hero-wrap { max-width:900px; margin:100px auto 0; padding:0 24px; }
    .hero-img { width:100%; max-height:420px; object-fit:cover; border-radius:16px; display:block; box-shadow:0 8px 30px rgba(30,26,74,.12); }

    /* ARTICLE HEADER */
    .article-header { max-width:780px; margin:32px auto 0; padding:0 24px; }
    .meta-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
    .cat-badge { background:var(--p500); color:#fff; padding:4px 14px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
    .date-text { color:var(--p400); font-size:13px; font-weight:500; }
    .article-header h1 { font-size:2.2rem; font-weight:800; line-height:1.2; color:var(--heading); margin-bottom:12px; }
    .subtitle { color:#666; font-size:1.05rem; line-height:1.6; }

    /* CONTENT */
    .article-content { max-width:780px; margin:36px auto; padding:0 24px; }
    .article-content h1 { font-size:1.8rem; margin:40px 0 14px; color:var(--heading); font-weight:700; }
    .article-content h2 { font-size:1.4rem; margin:36px 0 12px; color:var(--heading); font-weight:700; }
    .article-content h3 { font-size:1.15rem; margin:28px 0 10px; color:var(--heading); font-weight:600; }
    .article-content p { margin-bottom:16px; font-size:15.5px; line-height:1.75; color:#444; }
    .article-content ul, .article-content ol { margin:0 0 16px 24px; }
    .article-content li { margin-bottom:6px; font-size:15px; }
    .article-content a { color:var(--p500); text-decoration:underline; }
    .article-content a:hover { color:var(--p400); }
    .article-content strong { color:#333; }
    .article-content blockquote { border-left:4px solid var(--p500); padding:16px 20px; margin:24px 0; background:rgba(83,74,183,.06); border-radius:0 12px 12px 0; font-size:15px; }
    .article-content blockquote strong { color:var(--heading); }
    .article-content hr { border:none; border-top:1px solid rgba(83,74,183,.15); margin:32px 0; }
    .article-img { margin:28px 0; }
    .article-img img { width:100%; border-radius:12px; display:block; box-shadow:0 4px 20px rgba(30,26,74,.08); }
    .article-img figcaption { color:#999; font-size:12px; text-align:center; margin-top:8px; }
    .callout { display:flex; gap:12px; align-items:flex-start; background:#fff; border:1px solid rgba(83,74,183,.15); border-radius:12px; padding:16px 20px; margin:20px 0; box-shadow:0 2px 8px rgba(30,26,74,.04); }
    .callout-icon { font-size:20px; flex-shrink:0; margin-top:2px; }
    .callout div { font-size:14.5px; line-height:1.6; }
    .article-content code { background:rgba(83,74,183,.08); padding:2px 6px; border-radius:4px; font-size:0.88em; color:var(--p500); }
    .article-content pre { background:var(--p800); color:#e0e0e0; padding:20px; border-radius:12px; overflow-x:auto; margin:20px 0; }
    .article-content pre code { background:none; padding:0; color:inherit; }

    /* TAGS */
    .tags-wrap { max-width:780px; margin:0 auto; padding:0 24px; }
    .tags { display:flex; flex-wrap:wrap; gap:8px; margin:32px 0; }
    .tag { background:var(--p200); color:var(--heading); padding:6px 14px; border-radius:20px; font-size:12px; font-weight:500; }

    /* CTA BOX */
    .cta-box { max-width:780px; margin:0 auto 48px; padding:0 24px; }
    .cta-inner { background:var(--p800); border-radius:20px; padding:48px 40px; text-align:center; position:relative; overflow:hidden; }
    .cta-inner::before { content:''; position:absolute; top:-50%; right:-20%; width:300px; height:300px; background:radial-gradient(circle, rgba(83,74,183,.4), transparent 70%); border-radius:50%; }
    .cta-inner h3 { font-size:1.5rem; color:#fff; margin-bottom:10px; position:relative; }
    .cta-inner p { color:rgba(255,255,255,.65); margin-bottom:28px; font-size:15px; position:relative; }
    .cta-btn { display:inline-block; position:relative; background:var(--p500); color:#fff; padding:14px 36px; border-radius:30px; text-decoration:none; font-weight:700; font-size:15px; transition:transform .2s, box-shadow .2s; }
    .cta-btn:hover { transform:translateY(-2px); box-shadow:0 8px 25px rgba(83,74,183,.5); }

    /* FLOATING BUTTONS */
    .float-btns { position:fixed; bottom:24px; right:24px; display:flex; flex-direction:column; gap:12px; z-index:99; }
    .float-wa { width:56px; height:56px; border-radius:50%; background:#25D366; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(37,211,102,.4); transition:transform .2s; }
    .float-wa:hover { transform:scale(1.1); }
    .float-wa svg { width:28px; height:28px; fill:#fff; }
    .float-consult { display:flex; align-items:center; gap:8px; background:linear-gradient(135deg, #5B52CC, #8B82E8); color:#fff; padding:14px 24px; border-radius:30px; text-decoration:none; font-weight:700; font-size:14px; box-shadow:0 4px 20px rgba(83,74,183,.5), 0 0 0 1px rgba(139,130,232,.3); transition:transform .2s, box-shadow .2s; letter-spacing:0.3px; }
    .float-consult:hover { transform:translateY(-3px); box-shadow:0 8px 30px rgba(83,74,183,.6); }
    .float-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block; animation:dotPulse 2s ease-in-out infinite; }
    @keyframes dotPulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

    /* FOOTER */
    .footer { background:var(--p900); padding:32px 24px; text-align:center; color:rgba(255,255,255,.4); font-size:13px; }
    .footer a { color:var(--p400); text-decoration:none; }

    /* MOBILE NAV DRAWER */
    #mob-nav{display:none;position:fixed;top:68px;left:0;right:0;z-index:998;background:rgba(12,10,35,.97);backdrop-filter:blur(16px);border-bottom:1px solid rgba(139,130,232,.18);box-shadow:0 8px 32px rgba(0,0,0,.45);}
    #mob-nav.open{display:block;animation:mobNavOpen .45s cubic-bezier(.22,1,.36,1) forwards;}
    @keyframes mobNavOpen{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
    .mob-nav-btn{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid rgba(139,130,232,.08);color:rgba(255,255,255,.75);padding:15px 24px;font-size:15px;font-weight:500;cursor:pointer;font-family:'Inter',sans-serif;transition:background .2s,color .2s;text-decoration:none;}
    .mob-nav-btn:hover,.mob-nav-btn.mob-nav-active{background:rgba(91,82,204,.18);color:#fff;}

    /* RESPONSIVE */
    @media (max-width: 960px) {
      nav { padding:0 14px 0 12px; height:60px; }
      .tab-nav, .nav-cab-btn { display:none; }
      .mob-burger { display:flex; }
      .logo-name { font-size:20px; letter-spacing:1.5px; }
      .logo-sub { font-size:9px; letter-spacing:2px; }
      .hero-wrap { margin-top:80px; }
      .article-header h1 { font-size:1.7rem; }
      .hero-img { max-height:260px; }
      .cta-inner { padding:32px 24px; }
      .float-consult { padding:12px 18px; font-size:12px; }
      .lang-dd-trigger{padding:5px 8px 5px 6px;}
      .lang-dd-panel{position:fixed;top:64px;right:8px;left:auto;}
      #mob-nav{top:60px;}
    }
  </style>
</head>
<body>

  <!-- NAV — exact match to legalsol.pl -->
  <nav>
    <a class="logo" href="https://www.legalsol.pl">
      <svg width="30" height="28" viewBox="0 0 34 32"><rect x="0" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="9" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="18" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="27" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="0" y="5" width="34" height="4" rx="2" fill="#5B52CC"/><rect x="0" y="29" width="34" height="3" rx="1.5" fill="#5B52CC"/></svg>
      <div><div class="logo-name">LEGAL SOLUTIONS</div><div class="logo-sub">LEGALIZATION SERVICES</div></div>
    </a>
    <div class="tab-nav">
      <a class="tab-btn" href="https://www.legalsol.pl">${t.home}</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-services">${t.services}</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-jobs">${t.work}</a>
      <a class="tab-btn active" href="https://www.legalsol.pl#tab-blog">${t.blog}</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-ai">${t.ai}</a>
      <a class="tab-btn" href="https://www.legalsol.pl#tab-status">${t.checkStatus}</a>
      <a class="tab-btn referral-btn" href="https://www.legalsol.pl#tab-referral"><span class="shimmer"></span><span class="gift-icon">🎁</span>${t.referFriend}</a>
    </div>
    <div class="nav-right">
      <div class="lang-dd" id="lang-dd">
        <button class="lang-dd-trigger" onclick="document.getElementById('lang-dd').classList.toggle('open');event.stopPropagation();">
          <img src="https://flagcdn.com/20x15/${isRu ? 'ru' : 'gb'}.png" width="20" height="15" alt="${isRu ? 'RU' : 'EN'}" class="lang-flag">
          <span>${isRu ? 'RU' : 'EN'}</span>
          <svg class="arrow" width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="lang-dd-panel">
          <a class="ldp-btn${isRu ? ' active' : ''}" href="/blog/${isRu ? slug : otherSlug}"><img src="https://flagcdn.com/20x15/ru.png" width="20" height="15" alt="RU" class="lang-flag"><span class="ldp-code">RU</span><span class="ldp-name">\u0420\u0443\u0441\u0441\u043A\u0438\u0439</span></a>
          <a class="ldp-btn${!isRu ? ' active' : ''}" href="/blog/${!isRu ? slug : otherSlug}"><img src="https://flagcdn.com/20x15/gb.png" width="20" height="15" alt="EN" class="lang-flag"><span class="ldp-code">EN</span><span class="ldp-name">English</span></a>
        </div>
      </div>
      <a href="https://www.legalsol.pl#tab-cabinet" class="nav-cab-btn">\u{1F464} ${t.cabinet}</a>
      <button class="mob-burger" onclick="var mn=document.getElementById('mob-nav');mn.classList.toggle('open');" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </nav>

  <!-- MOBILE NAV DRAWER -->
  <div id="mob-nav">
    <a class="mob-nav-btn" href="https://www.legalsol.pl">${t.home}</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-services">${t.services}</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-jobs">${t.work}</a>
    <a class="mob-nav-btn mob-nav-active" href="https://www.legalsol.pl#tab-blog">${t.blog}</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-ai">${t.ai}</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-status">${t.checkStatus}</a>
    <a class="mob-nav-btn" href="https://www.legalsol.pl#tab-referral" style="color:#fde047;">${t.referFriend}</a>
  </div>

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
      <h3>${t.ctaTitle}</h3>
      <p>${t.ctaDesc}</p>
      <a href="https://www.legalsol.pl" class="cta-btn">${t.ctaBtn}</a>
    </div>
  </div>

  <div class="float-btns">
    <a href="https://wa.me/48XXXXXXXXX" class="float-wa" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>
    <a href="https://www.legalsol.pl" class="float-consult">
      <span class="float-dot"></span>
      <span>${t.consultation}</span>
    </a>
  </div>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} <a href="https://www.legalsol.pl">Legal Solutions</a> \u2014 ${t.footerText}</p>
  </footer>

  <script>document.addEventListener('click',function(){document.getElementById('lang-dd').classList.remove('open')});</script>
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

