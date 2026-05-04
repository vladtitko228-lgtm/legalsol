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

    ctaLabel: "\u0414\u043E\u0432\u0435\u0440\u044F\u044E\u0442 6 \u043B\u0435\u0442",

    ctaTitle: "\u041D\u0435 \u043E\u0441\u0442\u0430\u0432\u0430\u0439\u0442\u0435\u0441\u044C \u0431\u0435\u0437 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u2014\u00a0\u043C\u044B \u0432\u0441\u0451 \u0441\u0434\u0435\u043B\u0430\u0435\u043C",

    ctaDesc: "\u0437\u0430 6 \u043B\u0435\u0442 \u043C\u044B \u043F\u043E\u043C\u043E\u0433\u043B\u0438 \u0431\u043E\u043B\u0435\u0435 3\u00a0000 \u0438\u043D\u043E\u0441\u0442\u0440\u0430\u043D\u0446\u0435\u0432 \u043B\u0435\u0433\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u041F\u043E\u043B\u044C\u0448\u0435. \u0411\u0435\u0440\u0451\u043C \u043D\u0430 \u0441\u0435\u0431\u044F \u0432\u0441\u0451: \u0430\u043D\u0430\u043B\u0438\u0437 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F, \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B, \u043F\u043E\u0434\u0430\u0447\u0443 \u2014 \u0434\u043E \u043A\u0430\u0440\u0442\u044B \u0432 \u0440\u0443\u043A\u0430\u0445.",

    ctaBtn: "\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430\u044F \u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F \u2192",

    ctaBtnWa: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0432 WhatsApp",

    ctaBtnRequest: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443",

    ctaOr: "\u0438\u043B\u0438",

    ctaGuarantee: "\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u044F 98% \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u0439 \u00b7 \u0410\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u044F \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u00b7 \u041E\u0442\u0432\u0435\u0442 \u0437\u0430 15 \u043C\u0438\u043D\u0443\u0442",

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

    ctaLabel: "Trusted for 6 years",

    ctaTitle: "Don\u2019t stay without status \u2014 we\u2019ll handle everything",

    ctaDesc: "In 6 years Legal Solutions helped 3,000+ foreigners get legal status in Poland. We take care of everything: analysis, documents, submission \u2014 until the card is in your hands.",

    ctaBtn: "Free Consultation \u2192",

    ctaBtnWa: "Write on WhatsApp",

    ctaBtnRequest: "Leave a request",

    ctaOr: "or",

    ctaGuarantee: "98% approval rate \u00b7 Free appeal \u00b7 Reply within 15 min",

    consultation: "Free Consultation",

    footerText: "Immigration Services in Poland"

  };



  return `<!DOCTYPE html>

<html lang="${isRu ? 'ru' : 'en'}">

<head>

  <meta charset="UTF-8">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Cookie Consent banner + Clarity (loads after accept) -->
  <script src="/cookie-banner.js" defer></script>

  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <title>${esc(displayTitle)} | Legal Solutions</title>

  <meta name="description" content="${esc(seoDescription)}">

  <meta name="keywords" content="${esc(tagsStr)}, poland, immigration, legal solutions">

  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${isRu ? 'ru' : 'en'}" href="${canonical}">
  <link rel="alternate" hreflang="${isRu ? 'en' : 'ru'}" href="https://www.legalsol.pl/blog/${otherSlug}">
  <link rel="alternate" hreflang="x-default" href="https://www.legalsol.pl/blog/${isRu ? otherSlug : slug}">

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

    .lang-flag{border-radius:2px;flex-shrink:0;display:block;}

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

    .hero-wrap { max-width:900px; margin:16px auto 0; padding:0 24px; }

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

    .cta-inner {

      background:linear-gradient(145deg,#16113d 0%,#1e1856 50%,#12102e 100%);

      border-radius:20px; padding:44px 40px 40px;

      display:grid; grid-template-columns:1fr auto; gap:32px; align-items:center;

      position:relative; overflow:hidden;

      border:1px solid rgba(139,130,232,.18);

      box-shadow:0 0 0 1px rgba(91,82,204,.08), 0 24px 60px rgba(10,8,40,.35);

    }

    .cta-inner::before {

      content:''; position:absolute; top:0; left:0; right:0; height:1px;

      background:linear-gradient(90deg,transparent,rgba(139,130,232,.5),transparent);

    }

    .cta-left { position:relative; }

    .cta-eyebrow { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--p400); margin-bottom:12px; }

    .cta-inner h3 { font-size:1.55rem; color:#fff; margin-bottom:10px; font-weight:800; line-height:1.25; }

    .cta-inner .cta-desc { color:rgba(255,255,255,.5); font-size:14px; line-height:1.65; margin-bottom:24px; }

    .cta-btn {

      display:inline-flex; align-items:center; gap:8px;

      background:var(--p500); color:#fff; padding:13px 28px;

      border-radius:12px; text-decoration:none; font-weight:700; font-size:14px;

      transition:background .2s, transform .2s, box-shadow .2s;

      box-shadow:0 4px 20px rgba(91,82,204,.4);

      cursor:pointer; border:none;

    }

    .cta-btn:hover { background:var(--p700); transform:translateY(-2px); box-shadow:0 8px 28px rgba(91,82,204,.55); }

    .cta-btns-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }

    .cta-btn-wa { background:linear-gradient(135deg,#25d366 0%,#1eb555 100%); box-shadow:0 4px 20px rgba(37,211,102,.4); }

    .cta-btn-wa:hover { background:linear-gradient(135deg,#1eb555 0%,#1a9b48 100%); box-shadow:0 8px 28px rgba(37,211,102,.55); }

    .cta-btn-request { background:var(--p500); }

    .cta-btn-or { color:rgba(255,255,255,.4); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; }

    @media (max-width:600px){ .cta-btns-row { flex-direction:column; align-items:stretch; gap:8px; } .cta-btn-or { text-align:center; padding:4px 0; } .cta-btn { justify-content:center; } }

    .cta-guarantee { margin-top:12px; font-size:11.5px; color:rgba(255,255,255,.3); }

    .cta-right { display:flex; flex-direction:column; gap:20px; min-width:130px; }

    .trust-stat { text-align:center; padding:14px 18px; background:rgba(255,255,255,.04); border-radius:14px; border:1px solid rgba(139,130,232,.12); }

    .trust-stat-num { font-size:1.65rem; font-weight:800; color:#fff; line-height:1; letter-spacing:-1px; }

    .trust-stat-num span { color:var(--p400); }

    .trust-stat-label { font-size:10px; color:rgba(255,255,255,.38); margin-top:4px; text-transform:uppercase; letter-spacing:.8px; }

    @media(max-width:600px){

      .cta-inner { grid-template-columns:1fr; gap:24px; padding:28px 22px; }

      .cta-right { flex-direction:row; justify-content:center; }

      .trust-stat { flex:1; min-width:0; }

    }



    /* FLOATING BUTTONS */

    .float-btns { position:fixed; bottom:24px; right:24px; display:flex; flex-direction:column; gap:12px; z-index:99; align-items:flex-end; }

    .float-wa { width:56px; height:56px; border-radius:50%; background:#25D366; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(37,211,102,.4); transition:transform .2s; }

    .float-wa:hover { transform:scale(1.1); }

    .float-wa svg { width:28px; height:28px; fill:#fff; }

    .float-consult { display:flex; align-items:center; gap:8px; background:linear-gradient(135deg, #5B52CC, #8B82E8); color:#fff; padding:14px 24px; border-radius:30px; text-decoration:none; font-weight:700; font-size:14px; box-shadow:0 4px 20px rgba(83,74,183,.5), 0 0 0 1px rgba(139,130,232,.3); transition:transform .2s, box-shadow .2s; letter-spacing:0.3px; }

    .float-consult:hover { transform:translateY(-3px); box-shadow:0 8px 30px rgba(83,74,183,.6); }

    .float-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block; animation:dotPulse 2s ease-in-out infinite; }

    @keyframes dotPulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }



    /* BACK BUTTON */

    .back-btn {

      display:inline-flex;align-items:center;gap:8px;

      color:#fff;font-size:13px;font-weight:600;text-decoration:none;

      background:rgba(91,82,204,.45);border:1px solid rgba(139,130,232,.5);

      padding:8px 16px;border-radius:30px;

      transition:all .25s;

      animation:backPulse 3s ease-in-out infinite;

    }

    .back-btn:hover{background:rgba(91,82,204,.4);border-color:var(--p400);color:#fff;transform:translateX(-3px);}

    @keyframes backPulse{0%,100%{box-shadow:0 0 0 0 rgba(91,82,204,.0);}50%{box-shadow:0 0 0 6px rgba(91,82,204,.15);}}



    /* FOOTER */

    .footer { background:var(--p900); padding:32px 24px; text-align:center; color:rgba(255,255,255,.4); font-size:13px; }

    .footer a { color:var(--p400); text-decoration:none; }



    /* CONSULT MODAL */

    .modal-overlay{display:none;position:fixed;inset:0;background:rgba(5,4,20,.8);z-index:9999;backdrop-filter:blur(12px);align-items:center;justify-content:center;padding:24px;}

    .modal-overlay.open{display:flex;animation:modalFadeIn .2s ease;}

    @keyframes modalFadeIn{from{opacity:0}to{opacity:1}}

    .modal-box{

      background:#0f0d2a;

      border:1px solid rgba(139,130,232,.2);

      border-radius:20px;

      padding:0;

      max-width:420px;width:100%;

      position:relative;

      box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 1px rgba(91,82,204,.1);

      animation:modalSlide .3s cubic-bezier(.34,1.2,.64,1);

      overflow:hidden;

    }

    @keyframes modalSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

    .modal-head{

      background:linear-gradient(135deg,#1a1650 0%,#211d60 100%);

      padding:28px 32px 24px;

      border-bottom:1px solid rgba(139,130,232,.12);

      position:relative;

    }

    .modal-head::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,130,232,.3),transparent);}

    .modal-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:1px solid rgba(139,130,232,.2);color:rgba(255,255,255,.5);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;line-height:1;}

    .modal-close:hover{background:rgba(139,130,232,.2);color:#fff;border-color:rgba(139,130,232,.5);}

    .modal-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(91,82,204,.2);border:1px solid rgba(139,130,232,.25);border-radius:20px;padding:4px 10px 4px 8px;font-size:11px;font-weight:700;color:var(--p300);letter-spacing:.5px;margin-bottom:10px;}

    .modal-badge-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.6);flex-shrink:0;}

    .modal-head h3{font-size:1.25rem;color:#fff;font-weight:800;margin:0 0 6px;line-height:1.2;}

    .modal-head p{color:rgba(255,255,255,.45);font-size:13px;line-height:1.5;margin:0;}

    .modal-body{padding:24px 32px 28px;}

    .modal-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;margin-top:14px;}

    .modal-label:first-child{margin-top:0;}

    .modal-field{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(139,130,232,.2);border-radius:10px;padding:11px 14px;font-size:14px;color:#fff;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s,background .2s;}

    .modal-field:focus{border-color:var(--p400);background:rgba(91,82,204,.08);}

    .modal-field::placeholder{color:rgba(255,255,255,.25);}

    select.modal-field{appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;background-image:url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%237F77DD%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e');background-repeat:no-repeat;background-position:right 14px center;background-size:14px;padding-right:38px;}

    select.modal-field option{background:#1e1b4b;color:#fff;}

    .phone-row{display:flex;gap:8px;align-items:stretch;}
    .phone-row .phone-num{flex:1;}

    /* ── Country code picker (searchable) ── */
    .phone-cc-picker{position:relative;flex:0 0 130px;}
    .phone-cc-trigger{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:100%;background:rgba(255,255,255,.05);border:1px solid rgba(139,130,232,.2);border-radius:10px;padding:10px 10px 10px 12px;color:#fff;font-family:'Inter',sans-serif;font-size:14px;cursor:pointer;transition:background .15s,border-color .15s;outline:none;}
    .phone-cc-trigger:hover{background:rgba(139,130,232,.10);border-color:rgba(139,130,232,.4);}
    .phone-cc-trigger.cci-open{border-color:#7F77DD;background:rgba(127,119,221,.10);}
    .phone-cc-flag{font-size:18px;line-height:1;flex-shrink:0;}
    .phone-cc-code{font-weight:600;flex:1;text-align:left;color:#fff;}
    .phone-cc-arrow{flex-shrink:0;color:#7F77DD;transition:transform .25s ease;}
    .phone-cc-trigger.cci-open .phone-cc-arrow{transform:rotate(180deg);}

    .phone-cc-menu{position:absolute;top:calc(100% + 6px);left:0;width:320px;max-width:90vw;z-index:100;background:rgba(30,27,75,.97);backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);border:1px solid rgba(139,130,232,.35);border-radius:14px;padding:8px;box-shadow:0 16px 48px rgba(0,0,0,.5);opacity:0;visibility:hidden;transform:translateY(-8px) scale(.98);transform-origin:top left;transition:opacity .2s ease,transform .2s cubic-bezier(.4,0,.2,1),visibility .2s;}
    .phone-cc-menu.cci-open{opacity:1;visibility:visible;transform:translateY(0) scale(1);}
    .phone-cc-search{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(139,130,232,.2);border-radius:10px;padding:9px 12px;color:#fff;font-size:13px;font-family:inherit;outline:none;margin-bottom:6px;box-sizing:border-box;}
    .phone-cc-search::placeholder{color:rgba(255,255,255,.4);}
    .phone-cc-search:focus{border-color:#7F77DD;background:rgba(127,119,221,.10);}
    .phone-cc-list{max-height:280px;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:1px;}
    .phone-cc-list::-webkit-scrollbar{width:6px;}
    .phone-cc-list::-webkit-scrollbar-thumb{background:rgba(139,130,232,.3);border-radius:3px;}
    .phone-cc-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;color:rgba(255,255,255,.85);font-size:13px;cursor:pointer;transition:background .12s ease;user-select:none;}
    .phone-cc-item:hover{background:rgba(127,119,221,.18);color:#fff;}
    .phone-cc-item.cci-selected{background:rgba(127,119,221,.25);color:#fff;font-weight:600;}
    .phone-cc-item .cci-flag{font-size:18px;line-height:1;flex-shrink:0;}
    .phone-cc-item .cci-name{flex:1;color:rgba(255,255,255,.85);}
    .phone-cc-item .cci-code{flex-shrink:0;color:rgba(127,119,221,.95);font-weight:600;font-variant-numeric:tabular-nums;}
    .phone-cc-empty{display:none;padding:14px;color:rgba(255,255,255,.5);font-size:13px;text-align:center;}
    .phone-cc-list:empty + .phone-cc-empty{display:block;}
    @media (max-width:480px){.phone-cc-menu{width:280px;}.phone-cc-list{max-height:240px;}}

    .modal-wa-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;background:linear-gradient(135deg,#1fbe5a,#17a34a);color:#fff;border:none;padding:13px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:transform .2s,box-shadow .2s,filter .2s;box-shadow:0 4px 18px rgba(34,197,94,.25);margin-top:20px;}

    .modal-wa-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(34,197,94,.35);filter:brightness(1.05);}

    .modal-note{text-align:center;font-size:11.5px;color:rgba(255,255,255,.22);margin-top:14px;line-height:1.5;}



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

      .hero-wrap { margin-top:12px; }

      .article-header h1 { font-size:1.7rem; }

      .hero-img { max-height:260px; }

      .cta-inner { padding:32px 24px; }

      .float-btns { right:16px; bottom:16px; align-items:flex-end; }

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

          ${isRu ? '<svg width="24" height="16" viewBox="0 0 9 6" style="border-radius:2px;vertical-align:middle"><rect width="9" height="2" fill="#fff"/><rect y="2" width="9" height="2" fill="#0039A6"/><rect y="4" width="9" height="2" fill="#D52B1E"/></svg>' : '<svg width="24" height="16" viewBox="0 0 60 30" style="border-radius:2px;vertical-align:middle"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>'}

          <span>${isRu ? 'RU' : 'EN'}</span>

          <svg class="arrow" width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>

        </button>

        <div class="lang-dd-panel">

          <a class="ldp-btn${isRu ? ' active' : ''}" href="/blog/${isRu ? slug : otherSlug}"><svg width="20" height="14" viewBox="0 0 9 6" style="border-radius:2px;vertical-align:middle"><rect width="9" height="2" fill="#fff"/><rect y="2" width="9" height="2" fill="#0039A6"/><rect y="4" width="9" height="2" fill="#D52B1E"/></svg><span class="ldp-code">RU</span></a>

          <a class="ldp-btn${!isRu ? ' active' : ''}" href="/blog/${!isRu ? slug : otherSlug}"><svg width="20" height="14" viewBox="0 0 60 30" style="border-radius:2px;vertical-align:middle"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg><span class="ldp-code">EN</span></a>

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



  <div style="max-width:900px;margin:84px auto 0;padding:0 24px 0;">

    <a href="https://www.legalsol.pl#tab-blog" class="back-btn">${isRu ? '← Все статьи' : '← All articles'}</a>

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

      <div class="cta-left">

        <div class="cta-eyebrow">${t.ctaLabel}</div>

        <h3>${t.ctaTitle}</h3>

        <p class="cta-desc">${t.ctaDesc}</p>

        <div class="cta-btns-row">

          <a href="https://wa.me/48735248525?text=${encodeURIComponent((isRu ? 'Здравствуйте! Читал статью «' : 'Hello! I read the article \\u201C') + title + (isRu ? '» на legalsol.pl. Хочу бесплатную консультацию.' : '\\u201D on legalsol.pl. I would like a free consultation.'))}" target="_blank" rel="noopener" class="cta-btn cta-btn-wa">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>

            ${t.ctaBtnWa}

          </a>

          <span class="cta-btn-or">${t.ctaOr}</span>

          <button onclick="openConsultModal()" class="cta-btn cta-btn-request">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>

            ${t.ctaBtnRequest}

          </button>

        </div>

        <p class="cta-guarantee">${t.ctaGuarantee}</p>

      </div>

      <div class="cta-right">

        <div class="trust-stat"><div class="trust-stat-num">3000<span>+</span></div><div class="trust-stat-label">${isRu ? 'клиентов' : 'clients'}</div></div>

        <div class="trust-stat"><div class="trust-stat-num">6</div><div class="trust-stat-label">${isRu ? 'лет' : 'years'}</div></div>

        <div class="trust-stat"><div class="trust-stat-num">98<span>%</span></div><div class="trust-stat-label">${isRu ? 'одобрений' : 'approved'}</div></div>

      </div>

    </div>

  </div>



  <div class="float-btns">

    <a href="https://wa.me/48735248525" class="float-wa" target="_blank" rel="noopener">

      <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>

    </a>

    <button onclick="openConsultModal()" class="float-consult" style="border:none;cursor:pointer;">

      <span class="float-dot"></span>

      <span>${t.consultation}</span>

    </button>

  </div>



  <footer class="footer">

    <p>&copy; ${new Date().getFullYear()} <a href="https://www.legalsol.pl">Legal Solutions</a> \u2014 ${t.footerText}</p>

  </footer>



  <!-- CONSULT MODAL -->

  <div class="modal-overlay" id="consultModal" onclick="if(event.target===this)closeConsultModal()">

    <div class="modal-box">

      <div class="modal-head">

        <button class="modal-close" onclick="closeConsultModal()">&#x2715;</button>

        <div class="modal-badge"><span class="modal-badge-dot"></span>${isRu ? 'Онлайн · Ответим за 15 мин' : 'Online · Reply in 15 min'}</div>

        <h3>${isRu ? 'Оставить заявку' : 'Leave a request'}</h3>

        <p>${isRu ? 'Заполните форму — юрист свяжется с вами в течение 15 минут' : 'Fill in the form — a lawyer will contact you within 15 minutes'}</p>

      </div>

      <div class="modal-body">

        <div class="modal-label">${isRu ? 'Ваше имя' : 'Your name'}</div>

        <input class="modal-field" id="modal-name" type="text" placeholder="${isRu ? 'Как вас зовут?' : 'How should we address you?'}">

        <div class="modal-label">${isRu ? 'Телефон / WhatsApp' : 'Phone / WhatsApp'}</div>

        <div class="phone-row">
          <div class="phone-cc-picker" id="phone-cc-picker">
            <button type="button" class="phone-cc-trigger" id="phone-cc-trigger" onclick="cciToggle(event)" aria-haspopup="listbox" aria-expanded="false">
              <span class="phone-cc-flag" id="phone-cc-flag">🇵🇱</span>
              <span class="phone-cc-code" id="phone-cc-code">+48</span>
              <svg class="phone-cc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="phone-cc-menu" id="phone-cc-menu" role="listbox">
              <input type="text" class="phone-cc-search" id="phone-cc-search" placeholder="${isRu ? 'Поиск страны или кода…' : 'Search country or code…'}" autocomplete="off"/>
              <div class="phone-cc-list" id="phone-cc-list"></div>
              <div class="phone-cc-empty" id="phone-cc-empty">${isRu ? 'Не найдено' : 'No results'}</div>
            </div>
            <input type="hidden" id="modal-phone-cc" value="+48"/>
          </div>
          <input class="modal-field phone-num" id="modal-phone" type="tel" inputmode="numeric" placeholder="600 123 456">
        </div>

        <div class="modal-label">${isRu ? 'Какая услуга интересует?' : 'Which service?'}</div>

        <select class="modal-field" id="modal-service">
          <option value="">${isRu ? 'Не знаю — нужна консультация' : "Not sure — need advice"}</option>
          <option value="karta_pobytu">${isRu ? 'Карта побыту / вид на жительство' : 'Residence permit (Karta Pobytu)'}</option>
          <option value="permanent_residence">${isRu ? 'ПМЖ (постоянный побыт)' : 'Permanent residence'}</option>
          <option value="citizenship">${isRu ? 'Гражданство Польши' : 'Polish citizenship'}</option>
          <option value="blue_card">${isRu ? 'Blue Card (ЕС)' : 'Blue Card (EU)'}</option>
          <option value="appeals">${isRu ? 'Апелляция по отказу' : 'Appeals'}</option>
          <option value="company">${isRu ? 'Регистрация компании' : 'Company registration'}</option>
          <option value="accounting">${isRu ? 'Бухгалтерский учёт' : 'Accounting'}</option>
          <option value="pesel">${isRu ? 'Помощь с PESEL' : 'PESEL assistance'}</option>
          <option value="profil_zaufany">${isRu ? 'Profil Zaufany' : 'Profil Zaufany'}</option>
          <option value="driving">${isRu ? 'Замена прав' : 'Driving licence exchange'}</option>
          <option value="international_protection">${isRu ? 'Международная защита' : 'International protection'}</option>
        </select>

        <button class="modal-wa-btn" onclick="sendToWhatsApp()">

          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>

          ${isRu ? 'Отправить заявку' : 'Submit request'}

        </button>

        <p class="modal-note">${isRu ? '98% дел одобрено · Апелляция бесплатно · Без предоплаты' : '98% approval rate · Free appeal · No prepayment'}</p>

      </div>

    </div>

  </div>



  <script>

    document.addEventListener('click',function(){document.getElementById('lang-dd').classList.remove('open')});

    function openConsultModal(){document.getElementById('consultModal').classList.add('open');document.body.style.overflow='hidden';if(!_cciInited)cciInit();}

    function closeConsultModal(){document.getElementById('consultModal').classList.remove('open');document.body.style.overflow='';cciClose();}

    /* ── Country code picker (searchable) ── */
    var _cciInited=false;
    var _CCI=[
      // Priority order (Legal Solutions clients top regions first)
      {n:'Poland',c:'+48',f:'🇵🇱',s:'pl polska polonia poland'},
      {n:'Ukraine',c:'+380',f:'🇺🇦',s:'ua ukraine ukraina'},
      {n:'Russia',c:'+7',f:'🇷🇺',s:'ru russia rossiya kazakhstan kz'},
      {n:'Belarus',c:'+375',f:'🇧🇾',s:'by belarus belorussia'},
      {n:'Moldova',c:'+373',f:'🇲🇩',s:'md moldova'},
      {n:'Georgia',c:'+995',f:'🇬🇪',s:'ge georgia gruzia'},
      {n:'Azerbaijan',c:'+994',f:'🇦🇿',s:'az azerbaijan'},
      {n:'Armenia',c:'+374',f:'🇦🇲',s:'am armenia'},
      {n:'Kazakhstan',c:'+7',f:'🇰🇿',s:'kz kazakhstan'},
      {n:'Uzbekistan',c:'+998',f:'🇺🇿',s:'uz uzbekistan'},
      {n:'Kyrgyzstan',c:'+996',f:'🇰🇬',s:'kg kyrgyzstan kirgizia'},
      {n:'Tajikistan',c:'+992',f:'🇹🇯',s:'tj tajikistan'},
      {n:'Turkmenistan',c:'+993',f:'🇹🇲',s:'tm turkmenistan'},
      {n:'Turkey',c:'+90',f:'🇹🇷',s:'tr turkey turkiye'},
      {n:'India',c:'+91',f:'🇮🇳',s:'in india'},
      {n:'Pakistan',c:'+92',f:'🇵🇰',s:'pk pakistan'},
      {n:'Bangladesh',c:'+880',f:'🇧🇩',s:'bd bangladesh'},
      {n:'Sri Lanka',c:'+94',f:'🇱🇰',s:'lk sri lanka'},
      {n:'Nepal',c:'+977',f:'🇳🇵',s:'np nepal'},
      {n:'Indonesia',c:'+62',f:'🇮🇩',s:'id indonesia'},
      {n:'Philippines',c:'+63',f:'🇵🇭',s:'ph philippines'},
      {n:'Vietnam',c:'+84',f:'🇻🇳',s:'vn vietnam'},
      {n:'Thailand',c:'+66',f:'🇹🇭',s:'th thailand'},
      {n:'China',c:'+86',f:'🇨🇳',s:'cn china'},
      {n:'South Korea',c:'+82',f:'🇰🇷',s:'kr korea south'},
      {n:'Japan',c:'+81',f:'🇯🇵',s:'jp japan'},
      {n:'Malaysia',c:'+60',f:'🇲🇾',s:'my malaysia'},
      {n:'Singapore',c:'+65',f:'🇸🇬',s:'sg singapore'},
      // EU + Schengen
      {n:'Germany',c:'+49',f:'🇩🇪',s:'de germany deutschland'},
      {n:'United Kingdom',c:'+44',f:'🇬🇧',s:'uk united kingdom britain'},
      {n:'France',c:'+33',f:'🇫🇷',s:'fr france'},
      {n:'Italy',c:'+39',f:'🇮🇹',s:'it italy italia'},
      {n:'Spain',c:'+34',f:'🇪🇸',s:'es spain espana'},
      {n:'Portugal',c:'+351',f:'🇵🇹',s:'pt portugal'},
      {n:'Netherlands',c:'+31',f:'🇳🇱',s:'nl netherlands holland'},
      {n:'Belgium',c:'+32',f:'🇧🇪',s:'be belgium'},
      {n:'Austria',c:'+43',f:'🇦🇹',s:'at austria'},
      {n:'Switzerland',c:'+41',f:'🇨🇭',s:'ch switzerland'},
      {n:'Czech Republic',c:'+420',f:'🇨🇿',s:'cz czech czechia'},
      {n:'Slovakia',c:'+421',f:'🇸🇰',s:'sk slovakia'},
      {n:'Hungary',c:'+36',f:'🇭🇺',s:'hu hungary'},
      {n:'Romania',c:'+40',f:'🇷🇴',s:'ro romania'},
      {n:'Bulgaria',c:'+359',f:'🇧🇬',s:'bg bulgaria'},
      {n:'Greece',c:'+30',f:'🇬🇷',s:'gr greece'},
      {n:'Latvia',c:'+371',f:'🇱🇻',s:'lv latvia'},
      {n:'Lithuania',c:'+370',f:'🇱🇹',s:'lt lithuania'},
      {n:'Estonia',c:'+372',f:'🇪🇪',s:'ee estonia'},
      {n:'Finland',c:'+358',f:'🇫🇮',s:'fi finland'},
      {n:'Sweden',c:'+46',f:'🇸🇪',s:'se sweden'},
      {n:'Norway',c:'+47',f:'🇳🇴',s:'no norway'},
      {n:'Denmark',c:'+45',f:'🇩🇰',s:'dk denmark'},
      {n:'Ireland',c:'+353',f:'🇮🇪',s:'ie ireland'},
      {n:'Iceland',c:'+354',f:'🇮🇸',s:'is iceland'},
      {n:'Luxembourg',c:'+352',f:'🇱🇺',s:'lu luxembourg'},
      {n:'Malta',c:'+356',f:'🇲🇹',s:'mt malta'},
      {n:'Cyprus',c:'+357',f:'🇨🇾',s:'cy cyprus'},
      {n:'Slovenia',c:'+386',f:'🇸🇮',s:'si slovenia'},
      {n:'Croatia',c:'+385',f:'🇭🇷',s:'hr croatia'},
      {n:'Serbia',c:'+381',f:'🇷🇸',s:'rs serbia'},
      {n:'Bosnia and Herzegovina',c:'+387',f:'🇧🇦',s:'ba bosnia herzegovina'},
      {n:'Montenegro',c:'+382',f:'🇲🇪',s:'me montenegro'},
      {n:'North Macedonia',c:'+389',f:'🇲🇰',s:'mk north macedonia'},
      {n:'Albania',c:'+355',f:'🇦🇱',s:'al albania'},
      {n:'Kosovo',c:'+383',f:'🇽🇰',s:'xk kosovo'},
      // Americas
      {n:'United States',c:'+1',f:'🇺🇸',s:'us usa united states america'},
      {n:'Canada',c:'+1',f:'🇨🇦',s:'ca canada'},
      {n:'Mexico',c:'+52',f:'🇲🇽',s:'mx mexico'},
      {n:'Brazil',c:'+55',f:'🇧🇷',s:'br brazil brasil'},
      {n:'Argentina',c:'+54',f:'🇦🇷',s:'ar argentina'},
      {n:'Chile',c:'+56',f:'🇨🇱',s:'cl chile'},
      {n:'Colombia',c:'+57',f:'🇨🇴',s:'co colombia'},
      {n:'Peru',c:'+51',f:'🇵🇪',s:'pe peru'},
      {n:'Venezuela',c:'+58',f:'🇻🇪',s:'ve venezuela'},
      {n:'Ecuador',c:'+593',f:'🇪🇨',s:'ec ecuador'},
      {n:'Bolivia',c:'+591',f:'🇧🇴',s:'bo bolivia'},
      {n:'Paraguay',c:'+595',f:'🇵🇾',s:'py paraguay'},
      {n:'Uruguay',c:'+598',f:'🇺🇾',s:'uy uruguay'},
      {n:'Cuba',c:'+53',f:'🇨🇺',s:'cu cuba'},
      {n:'Dominican Republic',c:'+1',f:'🇩🇴',s:'do dominican'},
      {n:'Puerto Rico',c:'+1',f:'🇵🇷',s:'pr puerto rico'},
      {n:'Costa Rica',c:'+506',f:'🇨🇷',s:'cr costa rica'},
      {n:'Panama',c:'+507',f:'🇵🇦',s:'pa panama'},
      {n:'Guatemala',c:'+502',f:'🇬🇹',s:'gt guatemala'},
      {n:'Honduras',c:'+504',f:'🇭🇳',s:'hn honduras'},
      {n:'El Salvador',c:'+503',f:'🇸🇻',s:'sv el salvador'},
      {n:'Nicaragua',c:'+505',f:'🇳🇮',s:'ni nicaragua'},
      // Middle East
      {n:'Israel',c:'+972',f:'🇮🇱',s:'il israel'},
      {n:'United Arab Emirates',c:'+971',f:'🇦🇪',s:'ae uae emirates'},
      {n:'Saudi Arabia',c:'+966',f:'🇸🇦',s:'sa saudi arabia'},
      {n:'Qatar',c:'+974',f:'🇶🇦',s:'qa qatar'},
      {n:'Kuwait',c:'+965',f:'🇰🇼',s:'kw kuwait'},
      {n:'Bahrain',c:'+973',f:'🇧🇭',s:'bh bahrain'},
      {n:'Oman',c:'+968',f:'🇴🇲',s:'om oman'},
      {n:'Jordan',c:'+962',f:'🇯🇴',s:'jo jordan'},
      {n:'Lebanon',c:'+961',f:'🇱🇧',s:'lb lebanon'},
      {n:'Syria',c:'+963',f:'🇸🇾',s:'sy syria'},
      {n:'Iraq',c:'+964',f:'🇮🇶',s:'iq iraq'},
      {n:'Iran',c:'+98',f:'🇮🇷',s:'ir iran'},
      {n:'Yemen',c:'+967',f:'🇾🇪',s:'ye yemen'},
      {n:'Palestine',c:'+970',f:'🇵🇸',s:'ps palestine'},
      {n:'Afghanistan',c:'+93',f:'🇦🇫',s:'af afghanistan'},
      // Africa
      {n:'Egypt',c:'+20',f:'🇪🇬',s:'eg egypt'},
      {n:'Morocco',c:'+212',f:'🇲🇦',s:'ma morocco'},
      {n:'Algeria',c:'+213',f:'🇩🇿',s:'dz algeria'},
      {n:'Tunisia',c:'+216',f:'🇹🇳',s:'tn tunisia'},
      {n:'Libya',c:'+218',f:'🇱🇾',s:'ly libya'},
      {n:'Sudan',c:'+249',f:'🇸🇩',s:'sd sudan'},
      {n:'South Africa',c:'+27',f:'🇿🇦',s:'za south africa'},
      {n:'Nigeria',c:'+234',f:'🇳🇬',s:'ng nigeria'},
      {n:'Kenya',c:'+254',f:'🇰🇪',s:'ke kenya'},
      {n:'Ethiopia',c:'+251',f:'🇪🇹',s:'et ethiopia'},
      {n:'Ghana',c:'+233',f:'🇬🇭',s:'gh ghana'},
      {n:'Tanzania',c:'+255',f:'🇹🇿',s:'tz tanzania'},
      {n:'Uganda',c:'+256',f:'🇺🇬',s:'ug uganda'},
      {n:'Rwanda',c:'+250',f:'🇷🇼',s:'rw rwanda'},
      {n:'Senegal',c:'+221',f:'🇸🇳',s:'sn senegal'},
      {n:'Cote d Ivoire',c:'+225',f:'🇨🇮',s:'ci ivory coast'},
      {n:'Cameroon',c:'+237',f:'🇨🇲',s:'cm cameroon'},
      {n:'Angola',c:'+244',f:'🇦🇴',s:'ao angola'},
      {n:'Mozambique',c:'+258',f:'🇲🇿',s:'mz mozambique'},
      {n:'Zimbabwe',c:'+263',f:'🇿🇼',s:'zw zimbabwe'},
      {n:'Zambia',c:'+260',f:'🇿🇲',s:'zm zambia'},
      {n:'Madagascar',c:'+261',f:'🇲🇬',s:'mg madagascar'},
      // Oceania
      {n:'Australia',c:'+61',f:'🇦🇺',s:'au australia'},
      {n:'New Zealand',c:'+64',f:'🇳🇿',s:'nz new zealand'},
      {n:'Fiji',c:'+679',f:'🇫🇯',s:'fj fiji'},
      // Other
      {n:'Hong Kong',c:'+852',f:'🇭🇰',s:'hk hong kong'},
      {n:'Taiwan',c:'+886',f:'🇹🇼',s:'tw taiwan'},
      {n:'Macau',c:'+853',f:'🇲🇴',s:'mo macau'},
      {n:'Mongolia',c:'+976',f:'🇲🇳',s:'mn mongolia'},
      {n:'Myanmar',c:'+95',f:'🇲🇲',s:'mm myanmar burma'},
      {n:'Cambodia',c:'+855',f:'🇰🇭',s:'kh cambodia'},
      {n:'Laos',c:'+856',f:'🇱🇦',s:'la laos'},
      {n:'Brunei',c:'+673',f:'🇧🇳',s:'bn brunei'},
      {n:'Maldives',c:'+960',f:'🇲🇻',s:'mv maldives'},
      {n:'Bhutan',c:'+975',f:'🇧🇹',s:'bt bhutan'}
    ];

    function cciInit(){
      _cciInited=true;
      var list=document.getElementById('phone-cc-list');
      var search=document.getElementById('phone-cc-search');
      if(!list||!search)return;
      cciRenderList(_CCI);
      search.addEventListener('input',function(){
        var q=this.value.trim().toLowerCase();
        if(!q){cciRenderList(_CCI);return;}
        var filtered=_CCI.filter(function(it){
          if(it.c.indexOf(q)!==-1)return true;
          if(it.n.toLowerCase().indexOf(q)!==-1)return true;
          if(it.s.toLowerCase().indexOf(q)!==-1)return true;
          return false;
        });
        cciRenderList(filtered);
      });
    }
    function cciRenderList(items){
      var list=document.getElementById('phone-cc-list');
      var hidden=document.getElementById('modal-phone-cc');
      var current=hidden?hidden.value:'+48';
      var html='';
      for(var i=0;i<items.length;i++){
        var it=items[i];
        var sel=(it.c===current)?' cci-selected':'';
        html+='<div class="phone-cc-item'+sel+'" data-code="'+it.c+'" data-flag="'+it.f+'" onclick="cciSelect(this)"><span class="cci-flag">'+it.f+'</span><span class="cci-name">'+it.n+'</span><span class="cci-code">'+it.c+'</span></div>';
      }
      list.innerHTML=html;
    }
    function cciToggle(e){
      if(e){e.stopPropagation();e.preventDefault();}
      var t=document.getElementById('phone-cc-trigger'),m=document.getElementById('phone-cc-menu');
      if(!t||!m)return;
      if(m.classList.contains('cci-open')){cciClose();}else{cciOpen();}
    }
    function cciOpen(){
      var t=document.getElementById('phone-cc-trigger'),m=document.getElementById('phone-cc-menu'),s=document.getElementById('phone-cc-search');
      if(!t||!m)return;
      m.classList.add('cci-open');t.classList.add('cci-open');t.setAttribute('aria-expanded','true');
      setTimeout(function(){if(s)s.focus();},50);
    }
    function cciClose(){
      var t=document.getElementById('phone-cc-trigger'),m=document.getElementById('phone-cc-menu'),s=document.getElementById('phone-cc-search');
      if(!t||!m)return;
      m.classList.remove('cci-open');t.classList.remove('cci-open');t.setAttribute('aria-expanded','false');
      if(s)s.value='';
      cciRenderList(_CCI);
    }
    function cciSelect(el){
      if(!el)return;
      var code=el.getAttribute('data-code'),flag=el.getAttribute('data-flag');
      var hidden=document.getElementById('modal-phone-cc');
      var fl=document.getElementById('phone-cc-flag'),cd=document.getElementById('phone-cc-code');
      if(hidden)hidden.value=code;
      if(fl)fl.textContent=flag;
      if(cd)cd.textContent=code;
      cciClose();
      // фокус на номер для удобства
      var num=document.getElementById('modal-phone');if(num)num.focus();
    }
    document.addEventListener('click',function(e){
      var p=document.getElementById('phone-cc-picker');
      if(p && !p.contains(e.target))cciClose();
    });

    /* Submit заявки на консультацию из блога — только в Google Sheet, без открытия WA */
    function sendToWhatsApp(){
      var name=document.getElementById('modal-name').value.trim();
      var phoneRaw=document.getElementById('modal-phone').value.trim();
      var ccEl=document.getElementById('modal-phone-cc');
      var cc=ccEl?ccEl.value:'+48';
      var phone=cc+' '+phoneRaw.replace(/^\\+?\\s*/,'').replace(/^0+/,''); // убираем повторный + и ведущие нули
      var serviceEl=document.getElementById('modal-service');
      var serviceKey=serviceEl?serviceEl.value:'';
      var serviceText=serviceEl?(serviceEl.options[serviceEl.selectedIndex].text):'';
      var article=${JSON.stringify(title)};

      // Валидация — нужно минимум 6 цифр в самом номере (без кода страны)
      var digitsOnly=phoneRaw.replace(/\\D/g,'');
      if(!digitsOnly || digitsOnly.length<6){
        var phEl=document.getElementById('modal-phone');
        if(phEl){phEl.style.borderColor='#ef4444';setTimeout(function(){phEl.style.borderColor='';},2000);phEl.focus();}
        return;
      }

      // Отправка в Google Sheet
      var btn=document.querySelector('#consultModal .modal-wa-btn');
      if(btn)btn.disabled=true;

      // Service для таблицы: "Карта побыту" + контекст статьи
      var serviceForSheet=(serviceText && serviceKey)?(serviceText+' (from blog: '+article+')'):'Blog CTA · '+article;

      try{
        fetch('https://script.google.com/macros/s/AKfycbyZG4vGv31lRp15e7shZKESBZijliKIv5OKPi5zs9A4wSxouNU0osVFT6FQHt4SXPgrYQ/exec',{
          method:'POST',
          mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({
            name:name||'',
            phone:phone,
            service:serviceForSheet,
            message:'',
            source:'blog_article_cta',
            page:location.pathname,
            lang:'${isRu ? "ru" : "en"}',
            utm:{},
            ref:document.referrer||''
          })
        }).catch(function(){});
      }catch(e){}

      // Показать success state в самой модалке (без открытия WA)
      var modalBody=document.querySelector('#consultModal .modal-body');
      var modalHead=document.querySelector('#consultModal .modal-head');
      if(modalBody && modalHead){
        modalHead.innerHTML='<button class="modal-close" onclick="closeConsultModal()">×</button>'+
          '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;margin:8px auto 14px;box-shadow:0 8px 24px rgba(34,197,94,.45);">'+
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'+
          '</div>'+
          '<h3 style="text-align:center;">${isRu ? "Заявка отправлена!" : "Request received!"}</h3>'+
          '<p style="text-align:center;">${isRu ? "Наш специалист свяжется с вами в течение 15 минут." : "Our specialist will contact you within 15 minutes."}</p>';
        // Префилл WA с именем/телефоном для быстрого контакта
        var prefillMsg='${isRu ? "Здравствуйте! Я только что оставил заявку с блога legalsol.pl. Имя: " : "Hello! I just submitted a request from legalsol.pl blog. Name: "}'+(name||'—')+', '+
          '${isRu ? "телефон: " : "phone: "}'+phone+'. '+
          '${isRu ? "Статья: " : "Article: "}'+article+'.';
        modalBody.innerHTML='<p style="text-align:center;color:rgba(255,255,255,.6);font-size:13px;margin:0 0 16px;">${isRu ? "Не хотите ждать? Напишите в WhatsApp — ответим сразу." : "Don\\u2019t want to wait? Message us on WhatsApp — we\\u2019ll reply immediately."}</p>'+
          '<a href="https://wa.me/48735248525?text='+encodeURIComponent(prefillMsg)+'" target="_blank" rel="noopener" class="modal-wa-btn" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25d366,#1eb555);">'+
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'+
          '<span>${isRu ? "Написать в WhatsApp" : "Message us on WhatsApp"}</span>'+
          '</a>'+
          '<p class="modal-note" style="text-align:center;">${isRu ? "98% дел одобрено · Апелляция бесплатно · Без предоплаты" : "98% approval rate · Free appeal · No prepayment"}</p>';
      }
    }

    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeConsultModal();});

  </script>

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



