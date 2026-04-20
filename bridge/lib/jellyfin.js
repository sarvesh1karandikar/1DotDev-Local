import axios from "axios";
import fs from "fs";
import path from "path";

const JELLYFIN_URL = process.env.JELLYFIN_URL || "http://localhost:8096";
const JELLYFIN_TOKEN = process.env.JELLYFIN_TOKEN || process.env.JELLYFIN_API_KEY || "";
const MEDIA_ROOT = process.env.MEDIA_ROOT || "/home/sskgameon/media";
const TV_PATH = path.join(MEDIA_ROOT, "tv");

async function searchShowsViaAPI(query) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (JELLYFIN_TOKEN) {
      headers["X-MediaBrowser-Token"] = JELLYFIN_TOKEN;
    }

    const response = await axios.get(`${JELLYFIN_URL}/Items`, {
      params: {
        IncludeItemTypes: "Series",
        SearchTerm: query,
        Limit: 10,
        Fields: "Overview,Path,DateCreated",
      },
      headers,
      timeout: 5000,
    });

    const items = response.data.Items || [];
    return items.map((show) => ({
      id: show.Id,
      name: show.Name,
      overview: show.Overview,
      year: show.ProductionYear,
      streamUrl: `${JELLYFIN_URL}/web/index.html#!/itemdetails?id=${show.Id}`,
    }));
  } catch (e) {
    console.error("Jellyfin API searchShows error:", e.message);
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

export { searchShows, getEpisodesForShow, getAllShows };
