import { search } from "../lib/web-search.js";

export default {
  name: "web-search",
  adminOnly: false,
  category: "search",
  description: "Search the web for information",
  usage: "/web-search <query>",
  examples: ["latest AI news", "sci-fi shows 2026"],
  details: "Search Searxng (privacy-focused metasearch engine) for any topic.",
  async run({ from, args }) {
    if (!args.trim()) return "Usage: /web-search <query>";
    try {
      const results = await search(args.trim(), 5);
      if (results.length === 0) return `❌ No results found for "${args}"`;
      const list = results
        .map((r, i) => `${i + 1}. *${r.title}*\n   ${r.snippet}...\n   🔗 ${r.url}`)
        .join("\n\n");
      return `🔍 Found ${results.length} results for "${args}":\n\n${list}`;
    } catch (e) {
      return `❌ Search failed: ${e.message}`;
    }
  },
};
