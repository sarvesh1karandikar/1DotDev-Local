import { searchMovie } from "../lib/arr-stack.js";

export default {
  name: "search-movie",
  adminOnly: false,
  category: "media",
  description: "Search for a movie",
  usage: "/search-movie <query>",
  examples: ["Action", "Inception"],
  details: "Search TMDB for movies. Shows top 5 results.",
  async run({ from, args }) {
    if (!args.trim()) return "Usage: /search-movie <query>";
    try {
      const results = await searchMovie(args.trim());
      if (results.length === 0) return `❌ No movies found for "${args}"`;
      const list = results
        .map((m, i) => `${i + 1}. *${m.title}* (${m.year})\n   ${m.overview || "No description"}`)
        .join("\n\n");
      return `🔍 Found ${results.length} movies:\n\n${list}\n\nUse /add-movie <title> to add`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
