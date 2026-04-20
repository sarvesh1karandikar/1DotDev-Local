import { searchMovie, addMovie as addMovieToRadarr } from "../lib/arr-stack.js";

export default {
  name: "add-movie",
  adminOnly: false,
  category: "media",
  description: "Add a movie to Radarr",
  usage: "/add-movie <title>",
  examples: ["Inception", "The Matrix"],
  details: "Search for a movie by title and add it to your library.",
  async run({ from, args }) {
    if (!args.trim()) return "Usage: /add-movie <title>";
    try {
      const results = await searchMovie(args.trim());
      if (results.length === 0) return `❌ No movies found for "${args}"`;
      const first = results[0];
      const added = await addMovieToRadarr(first.tmdbId, "/media/movies");
      return `✅ Added: *${added.title}* (${first.year})\nDownload will start automatically.`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
