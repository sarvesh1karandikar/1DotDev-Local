import axios from "axios";
import fs from "fs";
import path from "path";
import { TTLCache } from "./cache.js";

const jellyfinCache = new TTLCache();

const JELLYFIN_URL = process.env.JELLYFIN_URL || "http://localhost:8096";
const JELLYFIN_TOKEN = process.env.JELLYFIN_TOKEN || process.env.JELLYFIN_API_KEY || "";
const MEDIA_ROOT = process.env.MEDIA_ROOT || "/home/sskgameon/media";
const TV_PATH = path.join(MEDIA_ROOT, "tv");

function jellyfinHeaders() {
  const h = { "Content-Type": "application/json" };
  if (JELLYFIN_TOKEN) h["X-MediaBrowser-Token"] = JELLYFIN_TOKEN;
  return h;
}

async function searchShowsViaAPI(query) {
  const cacheKey = "series:" + query.trim().toLowerCase();
  const cached = jellyfinCache.get(cacheKey);
  if (cached) return cached;
  try {
    const response = await axios.get(`${JELLYFIN_URL}/Items`, {
      params: {
        IncludeItemTypes: "Series",
        SearchTerm: query,
        Limit: 10,
        Fields: "Overview,Path,DateCreated",
      },
      headers: jellyfinHeaders(),
      timeout: 5000,
    });

    const items = response.data.Items || [];
    const results = items.map((show) => ({
      id: show.Id,
      name: show.Name,
      type: "Series",
      overview: show.Overview,
      year: show.ProductionYear,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/itemdetails?id=${show.Id}`,
    }));
    jellyfinCache.set(cacheKey, results);
    return results;
  } catch (e) {
    console.error("Jellyfin API searchShows error:", e.message);
    return [];
  }
}

async function searchMoviesViaAPI(query) {
  const cacheKey = "movie:" + query.trim().toLowerCase();
  const cached = jellyfinCache.get(cacheKey);
  if (cached) return cached;
  try {
    const response = await axios.get(`${JELLYFIN_URL}/Items`, {
      params: {
        IncludeItemTypes: "Movie",
        SearchTerm: query,
        Limit: 10,
        Fields: "Overview,Path,DateCreated",
      },
      headers: jellyfinHeaders(),
      timeout: 5000,
    });

    const items = response.data.Items || [];
    const results = items.map((m) => ({
      id: m.Id,
      name: m.Name,
      type: "Movie",
      overview: m.Overview,
      year: m.ProductionYear,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/itemdetails?id=${m.Id}`,
    }));
    jellyfinCache.set(cacheKey, results);
    return results;
  } catch (e) {
    console.error("Jellyfin API searchMovies error:", e.message);
    return [];
  }
}

async function searchAllViaAPI(query) {
  const cacheKey = "all:" + query.trim().toLowerCase();
  const cached = jellyfinCache.get(cacheKey);
  if (cached) return cached;
  try {
    const response = await axios.get(`${JELLYFIN_URL}/Items`, {
      params: {
        IncludeItemTypes: "Series,Movie",
        SearchTerm: query,
        Limit: 10,
        Fields: "Overview,Path,DateCreated",
      },
      headers: jellyfinHeaders(),
      timeout: 5000,
    });

    const items = response.data.Items || [];
    const results = items.map((item) => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      overview: item.Overview,
      year: item.ProductionYear,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/itemdetails?id=${item.Id}`,
    }));
    jellyfinCache.set(cacheKey, results);
    return results;
  } catch (e) {
    console.error("Jellyfin API searchAll error:", e.message);
    return [];
  }
}

async function getEpisodesViaAPI(showId) {
  try {
    const response = await axios.get(`${JELLYFIN_URL}/Shows/${showId}/Episodes`, {
      params: { Fields: "Overview" },
      headers: jellyfinHeaders(),
      timeout: 5000,
    });

    const items = response.data.Items || [];
    return items.map((ep) => ({
      id: ep.Id,
      name: ep.Name,
      seasonNumber: ep.ParentIndexNumber,
      episodeNumber: ep.IndexNumber,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/itemdetails?id=${ep.Id}`,
    }));
  } catch (e) {
    console.error("Jellyfin API getEpisodes error:", e.message);
    return [];
  }
}

function searchShowsViaFilesystem(query) {
  try {
    if (!fs.existsSync(TV_PATH)) return [];

    const shows = fs.readdirSync(TV_PATH).filter((f) => {
      const fullPath = path.join(TV_PATH, f);
      return fs.statSync(fullPath).isDirectory();
    });

    const filtered = shows.filter(
      (s) => s.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.map((name) => ({
      id: name.replace(/\s+/g, "-"),
      name,
      overview: `Available at ${path.join(TV_PATH, name)}`,
      year: null,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/search?query=${encodeURIComponent(name)}`,
    }));
  } catch (e) {
    console.error("Jellyfin filesystem search error:", e.message);
    return [];
  }
}

async function searchShows(query) {
  let results = await searchShowsViaAPI(query);
  if (results.length === 0) {
    results = searchShowsViaFilesystem(query);
  }
  return results;
}

function getAllShowsViaFilesystem() {
  try {
    if (!fs.existsSync(TV_PATH)) return [];

    const shows = fs
      .readdirSync(TV_PATH)
      .filter((f) => {
        const fullPath = path.join(TV_PATH, f);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort();

    return shows.map((name) => ({
      id: name.replace(/\s+/g, "-"),
      name,
      overview: `${name} - Available in your library`,
      year: null,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/search?query=${encodeURIComponent(name)}`,
    }));
  } catch (e) {
    console.error("Jellyfin getAllShows error:", e.message);
    return [];
  }
}

async function getAllShows() {
  const results = getAllShowsViaFilesystem();
  return results.length > 0 ? results : [];
}

function getEpisodesForShow(showName) {
  try {
    const showPath = path.join(TV_PATH, showName);
    if (!fs.existsSync(showPath)) return [];

    const episodes = [];
    const dirs = fs.readdirSync(showPath);

    for (const dir of dirs) {
      if (dir.toLowerCase().startsWith("season")) {
        const seasonPath = path.join(showPath, dir);
        const seasonFiles = fs.readdirSync(seasonPath);

        for (const file of seasonFiles) {
          if (file.endsWith(".mkv")) {
            episodes.push({
              name: file.replace(".mkv", ""),
              path: path.join(seasonPath, file),
              season: dir.match(/\d+/)?.[0],
              streamUrl: `${JELLYFIN_URL}/web/index.html#!/search?query=${encodeURIComponent(
                showName
              )}`,
            });
          }
        }
      }
    }

    return episodes;
  } catch (e) {
    console.error("Jellyfin getEpisodes error:", e.message);
    return [];
  }
}

export {
  searchShows,
  searchMoviesViaAPI,
  searchAllViaAPI,
  getEpisodesViaAPI,
  getEpisodesForShow,
  getAllShows,
};
