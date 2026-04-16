// Vercel Serverless Function â Blog Dynamic Inject v3
// Serves JS that upgrades static blog tab with real Notion data + cover images
// Route: /api/blog-inject
// Filters out EN posts (slug ending with -en) to show only RU on main page

const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB = process.env.NOTION_BLOG_DB_ID;

function txt(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map(t => t.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map(t => t.plain_text).join("");
  if (p.type === "select") return (p.select || {}).name || "";
  if (p.type === "multi_select") return (p.multi_select || []).map(s => s.name);
  if (p.type === "date") return (p.date || {}).start || "";
  if (p.type === "files") {
    const f = (p.files || [])[0];
    return f ? (f.type === "external" ? f.external.url : (f.file || {}).url || "") : "";
  }
  return "";
}

module.exports = async function handler(req, res) {
  try {
    const r = await notion.databases.query({
      database_id: DB,
      filter: { property: "Status", select: { equals: "Published" } },
      sorts: [{ property: "Published Date", direction: "descending" }],
      page_size: 20,
    });
    const allArts = r.results.map(pg => {
      const p = pg.properties;
      const cover = txt(p["Cover Image"]) || "";
      const pageCover = pg.cover
        ? (pg.cover.type === "external" ? pg.cover.external.url : (pg.cover.file || {}).url || "")
        : "";
      return {
        t: txt(p["Title"]),
        s: txt(p["Slug"]),
        c: txt(p["Category"]),
        d: txt(p["SEO Description"]),
        dt: txt(p["Published Date"]),
        img: cover || pageCover || ""
      };
    });
    // Show EN articles by default; if no EN version exists, show RU as fallback
    const enSlugs = new Set(allArts.filter(x => x.s.endsWith("-en")).map(x => x.s.replace(/-en$/, "")));
    const arts = allArts.filter(x => x.s.endsWith("-en") || !enSlugs.has(x.s));
    const fallbackMap = {
      "TAXES":            "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&w=600&q=75",
      "RESIDENCE PERMIT": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&w=600&q=75",
      "PESEL":            "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&w=600&q=75",
      "BUSINESS":         "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&w=600&q=75",
      "APPEALS":          "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&w=600&q=75",
      "PROFIL ZAUFANY":   "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&w=600&q=75",
      "BLUE CARD":        "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&w=600&q=75",
      "CUKR":             "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&w=600&q=75",
      "DEFAULT":          "https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&w=600&q=75",
    };
    arts.forEach(x => {
      const fb = fallbackMap[(x.c||"").toUpperCase()] || fallbackMap["DEFAULT"];
      // Notion file URLs (S3) expire — replace immediately with permanent Unsplash
      if (!x.img || x.img.includes('s3.amazonaws.com') || x.img.includes('prod-files-secure') || x.img.includes('secure.notion-static')) {
          x.img = fb;
      }
      x.fb = fb;
    });
    let js = "(function(){";
    js += "var a=" + JSON.stringify(arts) + ";";
    js += "var g=document.querySelector('#tab-blog .blog-grid');if(!g)return;";

    // inject search bar before the grid
    js += "var sw=document.getElementById('ls-blog-search-wrap');";
    js += "if(!sw){";
    js += "sw=document.createElement('div');sw.id='ls-blog-search-wrap';";
    js += "sw.style.cssText='max-width:560px;margin:0 auto 28px;position:relative;padding:0 24px;';";
    js += "sw.innerHTML='<svg style=\"position:absolute;left:38px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none\" width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/></svg>"
         + "<input id=\"ls-blog-si\" type=\"text\" placeholder=\"Search articles... / \\u041F\\u043E\\u0438\\u0441\\u043A \\u0441\\u0442\\u0430\\u0442\\u0435\\u0439...\" autocomplete=\"off\" "
         + "style=\"width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(124,92,252,.3);border-radius:30px;padding:11px 44px 11px 42px;color:#fff;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s,background .2s;\">"
         + "<button id=\"ls-blog-sc\" onclick=\"lsBlogClear()\" style=\"display:none;position:absolute;right:36px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:20px;line-height:1;padding:4px;\">\\u00d7</button>';";
    js += "g.parentNode.insertBefore(sw,g);";
    js += "document.getElementById('ls-blog-si').addEventListener('input',function(){lsBlogSearch(this.value);});";
    js += "}";

    // build cards
    js += "var h='';a.forEach(function(x){var ct=x.c||'';var ds=x.d||'';";
    js += "if(ds.length>120)ds=ds.substring(0,117)+'...';";
    js += "var imgHtml='<img src=\"'+x.img+'\" alt=\"\" loading=\"lazy\" style=\"width:100%;height:180px;object-fit:cover;display:block;border-radius:12px 12px 0 0\" onerror=\"this.src=\\''+x.fb+'\\';this.onerror=null;\">';";
    js += "h+='<a href=\"/blog/'+x.s+'\" class=\"blog-card ls-card\" data-t=\"'+x.t.toLowerCase()+'\" data-d=\"'+(x.d||'').toLowerCase()+'\" data-c=\"'+ct.toLowerCase()+'\" style=\"text-decoration:none;color:inherit\">';";
    js += "h+='<div style=\"height:180px;overflow:hidden;border-radius:12px 12px 0 0;position:relative;background:linear-gradient(135deg,#3D35A0,#7B72E8)\">'+imgHtml+(ct?'<div style=\"position:absolute;top:12px;left:12px;z-index:2;background:rgba(10,8,30,.72);backdrop-filter:blur(8px);color:#fff;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.15)\">'+ct+'</div>':'')+'</div>';";
    js += "h+='<div class=\"blog-body\"><div class=\"blog-date\">'+x.dt+'</div>';";
    js += "h+='<div class=\"blog-t\" style=\"font-size:15px;font-weight:700;line-height:1.3;margin:6px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word\">'+x.t+'</div>';";
    js += "h+='<div class=\"blog-e\" style=\"font-size:13px;color:rgba(255,255,255,.55);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden\">'+ds+'</div>';";
    js += "h+='<span class=\"blog-read\" style=\"color:#8B82E8;font-size:12px\">Read \\u2192</span>';";
    js += "h+='</div></a>';});";
    js += "if(h)g.innerHTML=h;";

    // search functions
    js += "window.lsBlogSearch=function(v){";
    js += "var q=v.trim().toLowerCase();";
    js += "document.getElementById('ls-blog-sc').style.display=q?'block':'none';";
    js += "var cards=document.querySelectorAll('.ls-card');var n=0;";
    js += "cards.forEach(function(c){var m=!q||(c.dataset.t+' '+c.dataset.d+' '+c.dataset.c).includes(q);c.style.display=m?'':'none';if(m)n++;});";
    js += "var nr=document.getElementById('ls-no-results');";
    js += "if(!nr){nr=document.createElement('div');nr.id='ls-no-results';nr.style.cssText='display:none;grid-column:1/-1;text-align:center;padding:48px 24px;color:rgba(255,255,255,.4);font-size:15px;';nr.textContent='\\uD83D\\uDD0D No articles found';g.appendChild(nr);}";
    js += "nr.style.display=(q&&n===0)?'block':'none';};";
    js += "window.lsBlogClear=function(){var i=document.getElementById('ls-blog-si');i.value='';lsBlogSearch('');i.focus();};";
    js += "})();";
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=120");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.status(200).send(js);
  } catch (e) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.status(200).send("// blog-inject error");
  }
};
