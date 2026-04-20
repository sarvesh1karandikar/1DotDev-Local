import { searchShows, getAllShows } from "../lib/jellyfin.js";

export default {
  name: "stream",
  adminOnly: false,
  category: "media",
  description: "Search available shows to stream on Jellyfin",
  usage: "stream <show name> or just 'stream' to list all",
  examples: ["Breaking Bad", "Severance"],
  details: "Search Jellyfin for available episodes you can stream right now. Returns direct streaming links.",
  async run({ from, args }) {
    try {
      let shows;

      if (!args || !args.trim()) {
        // List all shows
        shows = await getAllShows();
        if (shows.length === 0) {
          return "📺 No shows in Jellyfin yet.\n\nAdd shows with: /add-series <name>";
        }
        const list = shows
          .map((s, i) => `${i + 1}. *${s.name}* (${s.year || "unknown"})`)
          .join("\n");
        return `📺 Available to Stream:\n\n${list}\n\nUse: stream <show name> to see episodes`;
      } else {
        // Search for specific show
        shows = await searchShows(args.trim());
        if (shows.length === 0) {
          return `❌ "${args}" not found in Jellyfin.\n\nAdd with: /add-series ${args}`;
        }

        const show = shows[0]; // Get first result
        return `▶️  *${show.name}* (${show.year || "unknown"})\n\n${show.overview || "No description"}\n\n🎬 Stream here:\n${show.streamUrl}`;
      }
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
