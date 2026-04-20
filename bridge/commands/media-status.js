import { sonarrStatus, radarrStatus } from "../lib/arr-stack.js";

export default {
  name: "media-status",
  adminOnly: false,
  category: "media",
  description: "Show media library status",
  usage: "/media-status",
  details: "Check how many series/movies you have and what's currently downloading.",
  async run({ from }) {
    try {
      const sonarr = await sonarrStatus();
      const radarr = await radarrStatus();
      return `📊 *Media Library Status*\n\n📺 TV Shows: ${sonarr.series} (${sonarr.downloading} downloading)\n🎬 Movies: ${radarr.movies} (${radarr.downloading} downloading)`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
};
