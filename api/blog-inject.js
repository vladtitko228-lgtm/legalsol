// Vercel Serverless Function — Blog Dynamic Inject
// Serves JS that upgrades static blog tab with real Notion data
// Route: /api/blog-inject

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
                                                        page_size: 12,
                                                            });
                                                                const arts = r.results.map(pg => {
                                                                      const p = pg.properties;
                                                                            return {
                                                                                    t: txt(p["Title"]),
                                                                                            s: txt(p["Slug"]),
                                                                                                    c: txt(p["Category"]),
                                                                                                            d: txt(p["SEO Description"]),
                                                                                                                    dt: txt(p["Published Date"])
                                                                                                                          };
                                                                                                                              });
                                                                                                                                  let js = "(function(){var a=" + JSON.stringify(arts) + ";";
                                                                                                                                      js += "var g=document.querySelector('#tab-blog .blog-grid');if(!g)return;";
                                                                                                                                          js += "var h='';a.forEach(function(x){var ct=x.c||'';var ds=x.d||'';";
                                                                                                                                              js += "if(ds.length>120)ds=ds.substring(0,117)+'...';";
                                                                                                                                                  js += "h+='<a href=\"/blog/'+x.s+'\" class=\"blog-card\" style=\"text-decoration:none;color:inherit\">';";
                                                                                                                                                      js += "h+='<div class=\"blog-thumb\" style=\"background:linear-gradient(135deg,rgba(91,82,204,.15),rgba(139,130,232,.08));display:flex;align-items:center;justify-content:center\">';";
                                                                                                                                                          js += "h+='<div class=\"blog-cat\">'+ct+'</div></div>';";
                                                                                                                                                              js += "h+='<div class=\"blog-body\"><div class=\"blog-date\">'+x.dt+'</div>';";
                                                                                                                                                                  js += "h+='<div class=\"blog-t\">'+x.t+'</div>';";
                                                                                                                                                                      js += "h+='<div class=\"blog-e\">'+ds+'</div>';";
                                                                                                                                                                          js += "h+='<span class=\"blog-read\" style=\"color:#8B82E8;font-size:12px\">Read \\u2192</span>';";
                                                                                                                                                                              js += "h+='</div></a>'});";
                                                                                                                                                                                  js += "if(h)g.innerHTML=h;})();";
                                                                                                                                                                                      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
                                                                                                                                                                                          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
                                                                                                                                                                                              res.status(200).send(js);
                                                                                                                                                                                                } catch (e) {
                                                                                                                                                                                                    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
                                                                                                                                                                                                        res.status(200).send("// blog-inject error");
                                                                                                                                                                                                          }
                                                                                                                                                                                                          };