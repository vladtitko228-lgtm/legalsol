const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DATABASE_ID = process.env.NOTION_BLOG_DB_ID;
const SHELL = require("../_blog-shell.json"); // redesign chrome



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

        const imgUrl = safeUrl(block.image.type === "external" ? block.image.external.url : block.image.file.url);

        const caption = block.image.caption?.length ? richTextToHtml(block.image.caption) : "";

        // alt — только чистый текст (caption — это уже HTML), экранированный для атрибута
        const altText = esc((block.image.caption || []).map(t => t.plain_text).join("") || "Article image");

        // Premium magazine-style figure: gradient frame, hover zoom, italic caption with accent
        html += imgUrl ? `<figure class="article-img"><div class="article-img-frame"><img src="${esc(imgUrl)}" alt="${altText}" loading="lazy" decoding="async"></div>${caption ? `<figcaption><span class="cap-bar"></span>${caption}</figcaption>` : ''}</figure>\n` : "";

        break;

      case "callout":

        const icon = esc(block.callout.icon?.emoji || "\u{1F4A1}");

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

    if (t.href) { const u = safeUrl(t.href); if (u) s = `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${s}</a>`; }

    return s;

  }).join("");

}



function esc(s) {

  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

}

// Только безопасные схемы ссылок/картинок из Notion (отсекаем javascript:, data: и пр.)
function safeUrl(u) {

  u = String(u == null ? "" : u).trim();

  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(u) ? u : "";

}

// Экранирование JSON для вставки внутрь <script> (иначе "</script>" в тексте Notion закроет тег)
function jsonForScript(obj) {

  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

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



/* Detect FAQ section in Notion blocks and return [{question, answer}, ...].
   Pattern (per SKILL.md):
     - H2 with text matching /faq|frequently asked|часто задаваем|вопрос/i
     - Then alternating H3 (question) + paragraph(s) (answer)
   Stops collecting when next H2 / non-FAQ heading appears. */
function extractFaqFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  const faqs = [];
  let inFaq = false;
  let currentQ = null;
  let answerParts = [];

  function plain(rich) {
    if (!Array.isArray(rich)) return "";
    return rich.map(t => (t.plain_text || "")).join("");
  }

  function flushPair() {
    if (currentQ && answerParts.length) {
      const answer = answerParts.join(" ").trim();
      if (answer) faqs.push({ q: currentQ, a: answer });
    }
    currentQ = null;
    answerParts = [];
  }

  for (const b of blocks) {
    if (b.type === "heading_2") {
      // Either entering or leaving FAQ section
      flushPair();
      const t = plain(b.heading_2.rich_text).toLowerCase();
      inFaq = /faq|frequently asked|часто задаваем|вопрос|часто-задаваем/i.test(t);
      continue;
    }
    if (!inFaq) continue;
    if (b.type === "heading_3") {
      flushPair();
      currentQ = plain(b.heading_3.rich_text).trim();
      continue;
    }
    // collect answer text
    if (currentQ) {
      if (b.type === "paragraph") answerParts.push(plain(b.paragraph.rich_text));
      else if (b.type === "bulleted_list_item") answerParts.push(plain(b.bulleted_list_item.rich_text));
      else if (b.type === "numbered_list_item") answerParts.push(plain(b.numbered_list_item.rich_text));
    }
  }
  flushPair();
  return faqs.filter(f => f.q && f.a);
}


function articleLd(a, canonical) {
  const o = {
    "@context": "https://schema.org", "@type": "Article",
    "headline": a.seoTitle || a.title,
    "description": a.seoDescription || "",
    "datePublished": a.publishedDate || undefined,
    "author": { "@type": "Organization", "name": "LegalSol" },
    "publisher": { "@type": "Organization", "name": "LegalSol", "url": "https://legalsol.pl" },
    "mainEntityOfPage": canonical,
  };
  if (a.coverImage) o.image = a.coverImage;
  return '<script type="application/ld+json">' + jsonForScript(o) + '</script>';
}

function renderPage(a, contentHtml, faqs) {
  const { title, seoTitle, seoDescription, category, tags, publishedDate, slug, coverImage, lang } = a;
  const displayTitle = seoTitle || title;
  const canonical = `https://www.legalsol.pl/blog/${slug}`;
  const isRu = lang === "RU";
  const dateStr = publishedDate
    ? new Date(publishedDate).toLocaleDateString(isRu ? "ru-RU" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const cover = (!coverImage || coverImage.includes('s3.amazonaws.com') || coverImage.includes('prod-files-secure') || coverImage.includes('secure.notion-static'))
    ? "" : coverImage;
  const tagsArr = Array.isArray(tags) ? tags : [];
  const T = isRu
    ? { back: "Все статьи", ctaTitle: "Не оставайтесь без статуса — мы всё сделаем", ctaDesc: "Проанализируем ваше основание, соберём документы и подадим — бесплатная консультация в WhatsApp, ответ за 15 минут.", ctaWa: "Бесплатная консультация", faq: "Частые вопросы" }
    : { back: "All articles", ctaTitle: "Don't stay without status — we'll handle it", ctaDesc: "We'll assess your grounds, prepare the documents and file — a free WhatsApp consultation, reply within 15 minutes.", ctaWa: "Free consultation", faq: "Frequently asked questions" };

  // ---- article-body CSS (redesign tokens) ----
  const artCss = `
/* --- article page --- */
.art-wrap{max-width:820px;margin:0 auto;padding:0 24px}
.art-back{display:inline-flex;align-items:center;gap:7px;margin:26px auto 0;max-width:820px;padding:0 24px;color:var(--indigo);font-weight:700;font-size:14px;text-decoration:none}
.art-back:hover{text-decoration:underline}
.art-cover{max-width:960px;margin:20px auto 0;padding:0 24px}
.art-cover img{width:100%;height:auto;aspect-ratio:16/7;object-fit:cover;border-radius:var(--r);box-shadow:var(--sh-sm);display:block}
.art-head{max-width:820px;margin:28px auto 0;padding:0 24px}
.art-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.art-meta .cat{background:linear-gradient(135deg,var(--gold),var(--gold-2));color:#fff;padding:5px 14px;border-radius:var(--pill);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.art-meta .art-date{color:var(--ink-3);font-size:13.5px;font-weight:600}
.art-head h1{font-size:clamp(28px,4.4vw,42px);font-weight:800;line-height:1.14;letter-spacing:-.02em;color:var(--ink);margin-bottom:14px}
.art-head .art-sub{color:var(--ink-2);font-size:18px;line-height:1.6}
.article-content{max-width:820px;margin:30px auto;padding:0 24px}
.article-content h1{font-size:1.7rem;margin:38px 0 14px;color:var(--ink);font-weight:800}
.article-content h2{font-size:1.42rem;margin:34px 0 12px;color:var(--ink);font-weight:800}
.article-content h3{font-size:1.16rem;margin:26px 0 10px;color:var(--ink);font-weight:700}
.article-content p{margin-bottom:16px;font-size:16.5px;line-height:1.75;color:var(--ink-2)}
.article-content ul,.article-content ol{margin:0 0 16px 24px}
.article-content li{margin-bottom:7px;font-size:16px;line-height:1.7;color:var(--ink-2)}
.article-content a{color:var(--indigo);text-decoration:underline;text-underline-offset:2px}
.article-content a:hover{color:var(--indigo-7)}
.article-content strong{color:var(--ink);font-weight:700}
.article-content blockquote{border-left:4px solid var(--indigo);padding:16px 20px;margin:24px 0;background:var(--lilac);border-radius:0 12px 12px 0;font-size:16px;color:var(--ink-2)}
.article-content blockquote strong{color:var(--ink)}
.article-content hr{border:none;border-top:1px solid var(--line);margin:32px 0}
.article-content code{background:var(--lilac);padding:2px 6px;border-radius:4px;font-size:.88em;color:var(--indigo-7)}
.article-content pre{background:var(--indigo-9);color:#eee;padding:20px;border-radius:12px;overflow-x:auto;margin:20px 0}
.article-content pre code{background:none;padding:0;color:inherit}
.article-img{margin:36px 0}
.article-img img{width:100%;height:auto;display:block;border-radius:14px;box-shadow:var(--sh-sm)}
.article-img figcaption{display:flex;gap:9px;color:var(--ink-3);font-size:13.5px;font-style:italic;line-height:1.55;margin:12px 4px 0}
.article-img figcaption .cap-bar{flex:none;width:3px;height:18px;background:var(--indigo-2);border-radius:2px;margin-top:2px}
.callout{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:20px 0;box-shadow:var(--sh-sm)}
.callout-icon{font-size:20px;flex:none;margin-top:2px}
.callout div{font-size:15.5px;line-height:1.6;color:var(--ink-2)}
.art-tags{max-width:820px;margin:8px auto 0;padding:0 24px;display:flex;flex-wrap:wrap;gap:8px}
.art-tags .tag{background:var(--lilac);color:var(--indigo-7);padding:6px 13px;border-radius:var(--pill);font-size:12.5px;font-weight:600}
.art-cta-sec{margin:44px 0 8px}
.art-cta{max-width:820px;margin:0 auto;padding:34px 28px;background:linear-gradient(135deg,var(--lilac),#fff);border:1px solid var(--line);border-radius:var(--r);text-align:center;box-shadow:var(--sh-sm)}
.art-cta h2{font-size:clamp(21px,3vw,27px);font-weight:800;color:var(--ink);margin-bottom:10px}
.art-cta p{color:var(--ink-2);font-size:16px;line-height:1.6;max-width:520px;margin:0 auto 22px}
.art-faq{margin:20px 0 10px}
.art-faq .wrap{max-width:820px;margin:0 auto;padding:0 24px}
.art-faq h2{font-size:clamp(22px,3.4vw,30px);font-weight:800;color:var(--ink);margin-bottom:20px;text-align:center}
.art-faq details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:4px 20px;margin-bottom:12px;box-shadow:var(--sh-sm)}
.art-faq summary{cursor:pointer;font-weight:700;font-size:16.5px;color:var(--ink);padding:16px 0;list-style:none;display:flex;justify-content:space-between;gap:14px}
.art-faq summary::-webkit-details-marker{display:none}
.art-faq summary::after{content:"+";color:var(--indigo);font-weight:800;font-size:22px;line-height:1}
.art-faq details[open] summary::after{content:"−"}
.art-faq details p{color:var(--ink-2);font-size:15.5px;line-height:1.7;padding:0 0 16px}
@media(max-width:600px){.article-content p,.article-content li{font-size:16px}.art-head h1{font-size:26px}}
`;

  // ---- head from redesign shell ----
  let head = SHELL.head;
  head = head.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(displayTitle)} | LegalSol</title>`);
  head = head.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(seoDescription || "")}$2`);
  head = head.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(displayTitle)}$2`);
  head = head.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(seoDescription || "")}$2`);
  head = head.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${canonical}$2`);
  head = head.replace(/<html lang="en"/, `<html lang="${isRu ? 'ru' : 'en'}"`);
  // fix relative nav links on /blog/<slug> by adding a base
  head = head.replace(/<head>/, `<head>\n  <base href="/">`);
  // replace the listing's Blog JSON-LD with Article (+ FAQ) LD
  const faqLd = (Array.isArray(faqs) && faqs.length >= 2)
    ? '<script type="application/ld+json">' + jsonForScript({ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) }) + '</script>'
    : '';
  head = head.replace(/<script type="application\/ld\+json">\{[\s\S]*?"Blog"[\s\S]*?<\/script>/, articleLd(a, canonical) + (faqLd ? "\n" + faqLd : ""));
  if (coverImage) { head = head.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${esc(coverImage)}$2`).replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${esc(coverImage)}$2`); }
  head = head.replace('</style>', artCss + '</style>');

  // ---- FAQ block ----
  const faqHtml = (Array.isArray(faqs) && faqs.length >= 2)
    ? `<section class="art-faq"><div class="wrap"><h2>${T.faq}</h2>` +
      faqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("") +
      `</div></section>` : "";

  const wa = `https://wa.me/48735248525?text=${encodeURIComponent((isRu ? 'Здравствуйте! Вопрос по статье: ' : 'Hello! A question about the article: ') + (title || ''))}`;

  const body = `<!-- ARTICLE -->
<a class="art-back" href="/blog">← ${T.back}</a>
${cover ? `<div class="art-cover"><img src="${esc(cover)}" alt="${esc(title)}" width="1200" height="525"></div>` : ""}
<div class="art-head">
  <div class="art-meta">${category ? `<span class="cat">${esc(category)}</span>` : ""}${dateStr ? `<span class="art-date">${dateStr}</span>` : ""}</div>
  <h1>${esc(displayTitle)}</h1>
  ${seoDescription ? `<p class="art-sub">${esc(seoDescription)}</p>` : ""}
</div>
<article class="article-content">${contentHtml}</article>
${tagsArr.length ? `<div class="art-tags">${tagsArr.slice(0, 12).map(t => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
<section class="art-cta-sec"><div class="art-cta">
  <h2>${T.ctaTitle}</h2>
  <p>${T.ctaDesc}</p>
  <a class="btn btn-wa btn-lg" href="${wa}" target="_blank" rel="noopener">${T.ctaWa} →</a>
</div></section>
${faqHtml}
`;

  return head + "<!-- ARTICLE -->\n" + body + "\n" + SHELL.tail;
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



    let _blk=[], _cur=undefined;
    do {
      const _r = await notion.blocks.children.list({ block_id: page.id, page_size: 100, start_cursor: _cur });
      _blk = _blk.concat(_r.results);
      _cur = _r.has_more ? _r.next_cursor : undefined;
    } while (_cur);
    const blocks = { results: _blk };

    const contentHtml = blocksToHtml(blocks.results);
    const faqs = extractFaqFromBlocks(blocks.results);



    // Aggressive edge caching: 24h fresh, 7-day SWR. Articles change rarely;
    // we redeploy on each new post which invalidates cache anyway.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    res.status(200).send(renderPage(article, contentHtml, faqs));



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

<style>body{background:#FAF7F2;color:#211E3D;font-family:'Plus Jakarta Sans','Inter',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;text-align:center}

h1{font-size:4rem;margin-bottom:8px;color:#534AB7}p{color:#666;margin-bottom:24px;font-size:16px}

a{color:#fff;background:#534AB7;padding:12px 28px;border-radius:30px;text-decoration:none;font-weight:600;transition:all .2s}

a:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(83,74,183,.3)}</style>

</head><body><h1>404</h1><p>Article not found</p><a href="https://www.legalsol.pl">Back to Legal Solutions</a></body></html>`;

}



