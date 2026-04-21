import { searchShows, searchAllViaAPI, getEpisodesViaAPI, getAllShows } from "../lib/jellyfin.js";

const EPISODE_RE = /\bS(\d{1,2})E(\d{1,2})\b/i;

export default {
  name: "stream",
  adminOnly: false,
  category: "media",
  description: "Search shows and movies to stream on Jellyfin",
  usage: "stream <query> | stream <show> S01E01 | stream (list all)",
  examples: ["Breaking Bad", "inception", "Severance S01E03"],
  details: "Search Jellyfin for available content. Returns direct streaming links. Use S01E01 format for specific episodes.",
  async run({ from, args }) {
    try {
      if (!args || !args.trim()) {
        const shows = await getAllShows();
        if (shows.length === 0) {
          return "No content in Jellyfin yet.\n\nAdd shows with: /add-series <name>\nAdd movies with: /add-movie <name>";
        }
        const list = shows
          .map((s, i) => `${i + 1}. *${s.name}* (${s.year || "unknown"})`)
          .join("\n");
        return `Available to Stream:\n\n${list}\n\nUse /stream <name> for details\nUse /stream <show> S01E01 for episode links`;
      }

      const epMatch = args.match(EPISODE_RE);
      if (epMatch) {
        const showQuery = args.replace(EPISODE_RE, "").trim();
        const targetSeason = parseInt(epMatch[1], 10);
        const targetEpisode = parseInt(epMatch[2], 10);

        if (!showQuery) return "Please include a show name, e.g. /stream Breaking Bad S01E01";

        const shows = await searchShows(showQuery);
        if (shows.length === 0) {
          return `"${showQuery}" not found in Jellyfin.\n\nAdd with: /add-series ${showQuery}`;
        }

        const show = shows[0];
        const episodes = await getEpisodesViaAPI(show.id);
        if (episodes.length === 0) {
          return `Found *${show.name}* but no episodes available yet. They may still be downloading.`;
        }

        const match = episodes.find(
          (ep) => ep.seasonNumber === targetSeason && ep.episodeNumber === targetEpisode
        );
        if (!match) {
          const available = episodes
            .slice(0, 5)
            .map((ep) => `  S${String(ep.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")} - ${ep.name}`)
            .join("\n");
          return `S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")} not found for *${show.name}*.\n\nAvailable episodes:\n${available}${episodes.length > 5 ? `\n  ...and ${episodes.length - 5} more` : ""}`;
        }

        return `*${show.name}* - S${String(targetSeason).padStart(2, "0")}E${String(targetEpisode).padStart(2, "0")}\n${match.name}\n\nStream: ${match.streamUrl}`;
      }

      const results = await searchAllViaAPI(args.trim());
      if (results.length === 0) {
        return `"${args}" not found in Jellyfin.\n\nAdd shows: /add-series ${args}\nAdd movies: /add-movie ${args}`;
      }

      const list = results.slice(0, 5).map((r, i) => {
        const emoji = r.type === "Movie" ? "movie" : "tv";
        const yearStr = r.year ? ` (${r.year})` : "";
        const desc = r.overview ? `\n   ${r.overview.slice(0, 80)}${r.overview.length > 80 ? "..." : ""}` : "";
        return `${i + 1}. [${emoji}] *${r.name}*${yearStr}${desc}\n   ${r.streamUrl}`;
      }).join("\n\n");

      return `Results for "${args}":\n\n${list}${results.length > 5 ? `\n\n...and ${results.length - 5} more` : ""}\n\nFor episode links: /stream <show> S01E01`;
    } catch (e) {
      return `Error: ${e.message}`;
    }
  },
};
