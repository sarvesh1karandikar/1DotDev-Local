import { searchSeries } from "../lib/arr-stack.js";

export default {
  name: "search-series",
  adminOnly: false,
  category: "media",
  description: "Search for a TV series",
  usage: "/search-series <query>",
  examples: ["Sci-Fi", "Breaking Bad"],
  details: "Search TVDB for series. Shows top 5 results.",
  async run({ from, args }) {
    if (!args.trim()) return "Usage: /search-series <query>";
    try {
      const results = await searchSeries(args.trim());
      if (results.length === 0) return `❌ No series found for "${args}"`;
      const list = results
        .map((s, i) => `${i + 1}. *${s.title}* (${s.year})\n   ${s.overview || "No description"}`)
        .join("\n\n");
      return `🔍 Found ${results.length} series:\n\n${list}\n\nUse /add-series <title> to add`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
