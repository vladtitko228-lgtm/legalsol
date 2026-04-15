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

module.exports = async function handler(req, res) {
    try {
          const { category, language, tag, limit } = req.query;
          const pageSize = Math.min(parseInt(limit) || 50, 100);
          const filters = [{ property: "Status", select: { equals: "Published" } }];
          if (category) filters.push({ property: "Category", select: { equals: category } });
          if (language) filters.push({ property: "Language", select: { equals: language.toUpperCase() } });
          if (tag) filters.push({ property: "Tags", multi_select: { contains: tag } });

      const response = await notion.databases.query({
              database_id: DATABASE_ID,
              filter: { and: filters },
              sorts: [{ property: "Published Date", direction: "descending" }],
              page_size: pageSize,
      });

      const articles = response.results.map(page => {
              const props = page.properties;
              return {
                        id: page.id,
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

      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
          res.setHeader("Content-Type", "application/json");
          res.status(200).json({ articles, total: articles.length });
    } catch (error) {
          console.error("Notion API error:", error);
          res.status(500).json({ error: "Failed to fetch articles" });
    }
};
