import { searchSeries, addSeries as addSeriesToSonarr } from "../lib/arr-stack.js";

export default {
  name: "add-series",
  adminOnly: false,
  category: "media",
  description: "Add a TV series to Sonarr",
  usage: "/add-series <title>",
  examples: ["Breaking Bad", "The Office"],
  details: "Search for a series by title and add it to your library.",
  async run({ from, args }) {
    if (!args.trim()) return "Usage: /add-series <title>";
    try {
      const results = await searchSeries(args.trim());
      if (results.length === 0) return `❌ No series found for "${args}"`;
      const first = results[0];
      const added = await addSeriesToSonarr(first.tvdbId, "/media/tv");
      return `✅ Added: *${added.title}* (${first.year})\nEpisodes will download automatically.`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
