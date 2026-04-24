// Vercel Serverless Function â Blog Dynamic Inject v3

// Serves JS that upgrades static blog tab with real Notion data + cover images

// Route: /api/blog-inject

// Fetches published posts from Notion; main page shows RU posts, EN posts on /blog/{slug}-en



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

      page_size: 100,

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

        img: cover || pageCover || "",

        tg: (txt(p["Tags"]) || []).join("|"),

        lang: txt(p["Language"]) || ""

      };

    });

    // Show only EN posts in the public feed, limit to 9 for the homepage widget (3×3 grid)

    const arts = allArts.filter(x => x.lang === "EN").slice(0, 9);

    const fallbackMap = {

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



    // inject search bar before the grid (icon-only, right-aligned)

    js += "var sw=document.getElementById('ls-blog-search-wrap');";

    js += "if(!sw){";

    js += "sw=document.createElement('div');sw.id='ls-blog-search-wrap';";

    js += "sw.style.cssText='display:flex;justify-content:flex-end;align-items:center;margin:0 4px 14px;gap:8px;';";

    js += "sw.innerHTML='<div id=\"ls-si-wrap\" style=\"display:flex;align-items:center;justify-content:flex-end;position:relative;\">"

         + "<input id=\"ls-blog-si\" type=\"text\" placeholder=\"Search...\" autocomplete=\"off\" "

         + "style=\"width:0;opacity:0;background:rgba(255,255,255,.07);border:1px solid rgba(124,92,252,.3);border-radius:30px;padding:8px 34px 8px 14px;color:#fff;font-size:13px;outline:none;font-family:inherit;transition:width .35s cubic-bezier(.4,0,.2,1),opacity .35s,border-color .2s;\">"

         + "<button id=\"ls-blog-sb\" onclick=\"lsToggleSearch()\" title=\"Search\" style=\"flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(124,92,252,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;\">"

         + "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/></svg>"

         + "</button>"

         + "<button id=\"ls-blog-sc\" onclick=\"lsBlogClear()\" style=\"display:none;position:absolute;right:42px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:18px;line-height:1;padding:4px;\">\\u00d7</button>"

         + "</div>';";

    js += "g.parentNode.insertBefore(sw,g);";

    js += "document.getElementById('ls-blog-si').addEventListener('input',function(){lsBlogSearch(this.value);});";

    js += "document.getElementById('ls-blog-si').addEventListener('blur',function(){if(!this.value){var i=this;i.style.width='0';i.style.opacity='0';document.getElementById('ls-blog-sc').style.display='none';}});";

    js += "window.lsToggleSearch=function(){var i=document.getElementById('ls-blog-si');var open=i.style.width&&i.style.width!=='0px'&&i.style.width!=='0';if(open){if(!i.value){i.style.width='0';i.style.opacity='0';document.getElementById('ls-blog-sc').style.display='none';}}else{i.style.width='200px';i.style.opacity='1';i.focus();}};";

    js += "}";



    // build cards

    js += "var h='';a.forEach(function(x){var ct=x.c||'';var ds=x.d||'';";

    js += "if(ds.length>120)ds=ds.substring(0,117)+'...';";

    js += "var imgHtml='<img src=\"'+x.img+'\" alt=\"'+(x.t||x.c||'').replace(/\"/g,\"&quot;\")+'\" loading=\"lazy\" style=\"width:100%;height:180px;object-fit:cover;display:block;border-radius:12px 12px 0 0\" onerror=\"this.src=\\''+x.fb+'\\';this.onerror=null;\">';";

    js += "h+='<a href=\"/blog/'+x.s+'\" class=\"blog-card ls-card\" data-t=\"'+x.t.toLowerCase()+'\" data-d=\"'+(x.d||'').toLowerCase()+'\" data-c=\"'+ct.toLowerCase()+'\" data-tg=\"'+(x.tg||'').toLowerCase()+'\" style=\"text-decoration:none;color:inherit\">';";

    js += "h+='<div style=\"height:180px;overflow:hidden;border-radius:12px 12px 0 0;position:relative;background:linear-gradient(135deg,#3D35A0,#7B72E8)\">'+imgHtml+(ct?'<div style=\"position:absolute;top:12px;left:12px;z-index:2;background:rgba(10,8,30,.72);backdrop-filter:blur(8px);color:#fff;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.15)\">'+ct+'</div>':'')+'</div>';";

    js += "h+='<div class=\"blog-body\"><div class=\"blog-date\">'+x.dt+'</div>';";

    js += "h+='<div class=\"blog-t\" style=\"font-size:15px;font-weight:700;line-height:1.3;margin:6px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word\">'+x.t+'</div>';";

    js += "h+='<div class=\"blog-e\" style=\"font-size:13px;color:rgba(255,255,255,.55);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden\">'+ds+'</div>';";

    js += "h+=(x.tg?'<div style=\"display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 4px\">'+x.tg.split('|').filter(Boolean).slice(0,10).map(function(t){return '<span style=\"font-size:11px;color:rgba(167,139,250,.6);\">#'+t+'</span>';}).join('')+'</div>':'');";

    js += "h+='<span class=\"blog-read\" style=\"color:#8B82E8;font-size:12px\">Read \\u2192</span>';";

    js += "h+='</div></a>';});";

    js += "if(h)g.innerHTML=h;";

    js += "var wa=document.getElementById('ls-blog-all');if(!wa){wa=document.createElement('div');wa.id='ls-blog-all';wa.style.cssText='text-align:center;margin-top:32px;';wa.innerHTML='<a href=\"/blog\" style=\"display:inline-block;padding:12px 32px;background:rgba(124,92,252,0.15);border:1px solid rgba(124,92,252,0.4);border-radius:30px;color:#a78bfa;font-size:14px;font-weight:600;text-decoration:none;transition:all .2s;\" onmouseover=\"this.style.background=\\'rgba(124,92,252,0.3)\\'\" onmouseout=\"this.style.background=\\'rgba(124,92,252,0.15)\\'\">All articles \u2192</a>';g.parentNode.appendChild(wa);}";



    // search functions

    js += "window.lsBlogSearch=function(v){";

    js += "var q=v.trim().toLowerCase();";

    js += "document.getElementById('ls-blog-sc').style.display=q?'block':'none';";

    js += "var cards=document.querySelectorAll('.ls-card');var n=0;";

    js += "cards.forEach(function(c){var m=!q||(c.dataset.t+' '+c.dataset.d+' '+c.dataset.c+' '+c.dataset.tg).includes(q);c.style.display=m?'':'none';if(m)n++;});";

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

