// ============================================================
// Vercel Serverless Function  -  Blog Listing Page
// SSR page listing published articles from Notion, in the redesign look.
// Route: /blog  (via vercel.json rewrite)
// Redesign chrome comes from ./_blog-shell.json (generated from design_frame).
// Payload kept light: clean cards (tags are searchable data, not rendered),
// first INITIAL_SHOW visible, rest revealed via search / "Load more".
// ============================================================

const { Client } = require("@notionhq/client");
const SHELL = require("./_blog-shell.json"); // { head, tail } — redesign frame

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_BLOG_DB_ID;

const INITIAL_SHOW = 24;

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
  "TAXES":            "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&w=600&q=70",
  "RESIDENCE PERMIT": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&w=600&q=70",
  "PESEL":            "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&w=600&q=70",
  "BUSINESS":         "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&w=600&q=70",
  "APPEALS":          "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&w=600&q=70",
  "PROFIL ZAUFANY":   "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&w=600&q=70",
  "BLUE CARD":        "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&w=600&q=70",
  "CUKR":             "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&w=600&q=70",
  "GUIDES":           "https://images.unsplash.com/photo-1521791055366-0d553872952f?auto=format&w=600&q=70",
  "GUIDE":            "https://images.unsplash.com/photo-1521791055366-0d553872952f?auto=format&w=600&q=70",
  "LEGAL":            "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&w=600&q=70",
  "LIFESTYLE":        "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&w=600&q=70",
  "FINANCE":          "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&w=600&q=70",
  "LIFEHACK":         "https://images.unsplash.com/photo-1484807352052-23338990c6c6?auto=format&w=600&q=70",
  "DEFAULT":          "https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&w=600&q=70",
};
function getFallback(category) {
  return FALLBACK_IMAGES[(category || "").toUpperCase()] || FALLBACK_IMAGES["DEFAULT"];
}
function coverFor(a) {
  return (!a.coverImage || a.coverImage.includes('s3.amazonaws.com') || a.coverImage.includes('prod-files-secure') || a.coverImage.includes('secure.notion-static'))
    ? getFallback(a.category) : a.coverImage;
}

function renderArticleCard(article, idx) {
  const dateStr = article.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const fallback = getFallback(article.category);
  const imgSrc = coverFor(article);
  const tagsArr = Array.isArray(article.tags) ? article.tags : [];
  const tagsStr = tagsArr.join(" ");           // searchable, not rendered (keeps payload/DOM light)
  const hidden = idx >= INITIAL_SHOW ? " lsb-hidden" : "";

  return `<a href="/blog/${escapeHtml(article.slug)}" class="bcard blog-card${hidden}" data-title="${escapeHtml(article.title)}" data-desc="${escapeHtml(article.seoDescription)}" data-cat="${escapeHtml(article.category)}" data-tags="${escapeHtml(tagsStr)}">`
    + `<div class="bc-cover"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(article.title || article.category || 'Article')}" loading="lazy" onerror="this.src='${fallback}';this.onerror=null;"></div>`
    + (article.category ? `<div class="cat">${escapeHtml(article.category)}</div>` : "")
    + `<h3>${escapeHtml(article.title)}</h3>`
    + (article.seoDescription ? `<p>${escapeHtml(article.seoDescription)}</p>` : "")
    + `<div class="bfoot"><span class="bread">Read →</span>${dateStr ? `<span class="bdate">${dateStr}</span>` : ""}</div>`
    + `</a>`;
}

function renderPage(articles) {
  const cardsHtml = articles.map(renderArticleCard).join("\n");
  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];
  const chips = `<button class="lsb-chip active" data-cat="">All</button>`
    + categories.map(c => `<button class="lsb-chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");

  const searchSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;

  const listing = `
<section class="lsb-hero"><div class="wrap">
  <span class="eyebrow">Blog</span>
  <h1>Immigration Blog</h1>
  <p>Expert guides, tips and news about living and working in Poland.</p>
  <div class="lsb-tools">
    <div class="lsb-search">${searchSvg}
      <input id="lsbSearch" type="text" placeholder="Search articles… / Поиск статей…" autocomplete="off" aria-label="Search articles">
    </div>
    ${categories.length > 1 ? `<div class="lsb-chips" id="lsbChips">${chips}</div>` : ""}
  </div>
</div></section>
<section style="padding-top:8px"><div class="wrap">
  <div class="lsb-grid" id="lsbGrid">
${cardsHtml}
  </div>
  <p class="lsb-empty" id="lsbEmpty">Nothing found. Try another word — or <a href="https://wa.me/48735248525?text=${encodeURIComponent('Здравствуйте! Вопрос по легализации в Польше.')}" style="color:var(--indigo);font-weight:700">ask us on WhatsApp</a>.</p>
  <div class="lsb-more" id="lsbMore"><button class="btn btn-ghost btn-lg" id="lsbMoreBtn" style="width:auto;margin-top:0">Load more articles</button></div>
</div></section>

<script>
(function(){
  var INIT=${INITIAL_SHOW}, shown=INIT;
  var grid=document.getElementById('lsbGrid');
  if(!grid) return;
  var cards=[].slice.call(grid.querySelectorAll('.blog-card'));
  var search=document.getElementById('lsbSearch');
  var empty=document.getElementById('lsbEmpty');
  var moreWrap=document.getElementById('lsbMore');
  var moreBtn=document.getElementById('lsbMoreBtn');
  var chipsWrap=document.getElementById('lsbChips');
  var activeCat='';
  function norm(s){return (s||'').toLowerCase();}
  function apply(){
    var q=norm(search&&search.value).trim();
    var limited = !q && !activeCat;
    var matches=0, i=0;
    for(var k=0;k<cards.length;k++){
      var c=cards[k];
      var okCat=!activeCat || c.getAttribute('data-cat')===activeCat;
      var hay=norm(c.getAttribute('data-title')+' '+c.getAttribute('data-desc')+' '+c.getAttribute('data-cat')+' '+c.getAttribute('data-tags'));
      var okQ=!q || hay.indexOf(q)>=0;
      if(okCat&&okQ){
        matches++;
        if(limited && i>=shown){ c.classList.add('lsb-hidden'); }
        else { c.classList.remove('lsb-hidden'); }
        i++;
      } else { c.classList.add('lsb-hidden'); }
    }
    if(empty) empty.style.display = matches===0 ? 'block' : 'none';
    if(moreWrap) moreWrap.style.display = (limited && matches>shown) ? '' : 'none';
  }
  if(search) search.addEventListener('input', function(){ shown=INIT; apply(); });
  if(moreBtn) moreBtn.addEventListener('click', function(){ shown+=INIT; apply(); });
  if(chipsWrap) chipsWrap.addEventListener('click', function(e){
    var b=e.target.closest('.lsb-chip'); if(!b) return;
    activeCat=b.getAttribute('data-cat')||'';
    [].forEach.call(chipsWrap.querySelectorAll('.lsb-chip'), function(x){ x.classList.toggle('active', x===b); });
    shown=INIT; apply();
  });
  apply();
})();
</script>
`;

  return SHELL.head + "<!-- BLOG -->\n" + listing + "\n" + SHELL.tail;
}

module.exports = async function handler(req, res) {
  try {
    // Fetch ALL published pages — paginate (blog has grown past 100 posts).
    let allResults = [];
    let startCursor = undefined;
    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: { property: "Status", select: { equals: "Published" } },
        sorts: [{ property: "Published Date", direction: "descending" }],
        page_size: 100,
        start_cursor: startCursor,
      });
      allResults = allResults.concat(response.results);
      startCursor = response.has_more ? response.next_cursor : undefined;
    } while (startCursor);

    const articles = allResults.map(page => {
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

    // Language: ?lang=ru → RU posts, else EN
    const reqLang = (req.query && req.query.lang) ? String(req.query.lang).toUpperCase() : "EN";
    const wantLang = (reqLang === "RU") ? "RU" : "EN";
    const filtered = articles.filter(a => a.language === wantLang);

    // JSON mode (homepage cards): short cache so a new post appears quickly
    if (req.query && req.query.format === "json") {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
      res.setHeader("CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
      res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
      const slim = filtered.slice(0, limit).map(a => ({
        title: a.title, slug: a.slug, category: a.category,
        seoDescription: a.seoDescription, coverImage: coverFor(a), publishedDate: a.publishedDate,
      }));
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).send(JSON.stringify({ articles: slim, lang: wantLang }));
      return;
    }

    // HTML mode: aggressive CDN cache — the listing changes a few times/day, and
    // stale-while-revalidate keeps it instant while it refreshes in the background.
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderPage(filtered));

  } catch (error) {
    console.error("Notion API error:", error);
    res.status(500).send("<h1>Error loading blog</h1><p>Please try again later.</p>");
  }
};
