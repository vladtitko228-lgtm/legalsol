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
    const arts = r.results.map(pg => {
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
    }).filter(x => !x.s.endsWith("-en"));
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
    js += "var h='';a.forEach(function(x){var ct=x.c||'';var ds=x.d||'';";
    js += "if(ds.length>120)ds=ds.substring(0,117)+'...';";
    js += "var imgHtml='<img src=\"'+x.img+'\" alt=\"\" loading=\"lazy\" style=\"width:100%;height:180px;object-fit:cover;display:block;border-radius:12px 12px 0 0\" onerror=\"this.src=\\''+x.fb+'\\';this.onerror=null;\">';";
    js += "h+='<a href=\"/blog/'+x.s+'\" class=\"blog-card\" style=\"text-decoration:none;color:inherit\">';";
    js += "h+='<div style=\"height:180px;overflow:hidden;border-radius:12px 12px 0 0;position:relative;background:linear-gradient(135deg,#3D35A0,#7B72E8)\">'+imgHtml+'<div class=\"blog-cat\" style=\"position:absolute;top:12px;left:12px;z-index:1\">'+ct+'</div></div>';";
    js += "h+='<div class=\"blog-body\"><div class=\"blog-date\">'+x.dt+'</div>';";
    js += "h+='<div class=\"blog-t\" style=\"font-size:15px;font-weight:700;line-height:1.3;margin:6px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word\">'+x.t+'</div>';";
    js += "h+='<div class=\"blog-e\" style=\"font-size:13px;color:rgba(255,255,255,.55);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden\">'+ds+'</div>';";
    js += "h+='<span class=\"blog-read\" style=\"color:#8B82E8;font-size:12px\">Read \\u2192</span>';";
    js += "h+='</div></a>';});";
    js += "if(h)g.innerHTML=h;})();";
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=120");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.status(200).send(js);
  } catch (e) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.status(200).send("// blog-inject error");
  }
};
