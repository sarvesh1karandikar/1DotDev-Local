import axios from "axios";

const {
  SONARR_URL = "http://localhost:8989",
  SONARR_API_KEY,
  RADARR_URL = "http://localhost:7878",
  RADARR_API_KEY,
  LIDARR_URL = "http://localhost:8686",
  LIDARR_API_KEY,
  PROWLARR_URL = "http://localhost:9696",
  PROWLARR_API_KEY,
} = process.env;

const headers = (apiKey) => ({
  "X-Api-Key": apiKey,
  "Content-Type": "application/json",
});

export async function searchSeries(query) {
  try {
    const res = await axios.get(`${SONARR_URL}/api/v3/series/lookup`, {
      params: { term: query },
      headers: headers(SONARR_API_KEY),
      timeout: 10000,
    });
    return res.data.slice(0, 5).map(s => ({
      title: s.title,
      tvdbId: s.tvdbId,
      year: s.year,
      overview: s.overview?.slice(0, 100),
    }));
  } catch (e) {
    throw new Error(`Sonarr search failed: ${e.message}`);
  }
}

export async function addSeries(tvdbId, folder = "/media/tv", monitored = true) {
  try {
    const res = await axios.post(`${SONARR_URL}/api/v3/series`, {
      tvdbId,
      qualityProfileId: 1,
      rootFolderPath: folder,
      monitored,
      addOptions: { searchForMissingEpisodes: true },
    }, { headers: headers(SONARR_API_KEY), timeout: 10000 });
    return { success: true, title: res.data.title, id: res.data.id };
  } catch (e) {
    throw new Error(`Failed to add series: ${e.response?.data?.message || e.message}`);
  }
}

export async function searchMovie(query) {
  try {
    const res = await axios.get(`${RADARR_URL}/api/v3/search`, {
      params: { term: query },
      headers: headers(RADARR_API_KEY),
      timeout: 10000,
    });
    return res.data.slice(0, 5).map(m => ({
      title: m.title,
      tmdbId: m.tmdbId,
      year: m.year,
      overview: m.overview?.slice(0, 100),
    }));
  } catch (e) {
    throw new Error(`Radarr search failed: ${e.message}`);
  }
}

export async function addMovie(tmdbId, folder = "/media/movies", monitored = true) {
  try {
    const res = await axios.post(`${RADARR_URL}/api/v3/movie`, {
      tmdbId,
      qualityProfileId: 1,
      rootFolderPath: folder,
      monitored,
      addOptions: { searchForMovie: true },
    }, { headers: headers(RADARR_API_KEY), timeout: 10000 });
    return { success: true, title: res.data.title, id: res.data.id };
  } catch (e) {
    throw new Error(`Failed to add movie: ${e.response?.data?.message || e.message}`);
  }
}

export async function sonarrStatus() {
  try {
    const seriesRes = await axios.get(`${SONARR_URL}/api/v3/series`, {
      headers: headers(SONARR_API_KEY),
      timeout: 10000,
    });
    const queueRes = await axios.get(`${SONARR_URL}/api/v3/queue`, {
      headers: headers(SONARR_API_KEY),
      timeout: 10000,
    });
    return {
      series: seriesRes.data.length,
      downloading: queueRes.data.length,
    };
  } catch (e) {
    throw new Error(`Sonarr status failed: ${e.message}`);
  }
}

export async function radarrStatus() {
  try {
    const moviesRes = await axios.get(`${RADARR_URL}/api/v3/movie`, {
      headers: headers(RADARR_API_KEY),
      timeout: 10000,
    });
    const queueRes = await axios.get(`${RADARR_URL}/api/v3/queue`, {
      headers: headers(RADARR_API_KEY),
      timeout: 10000,
    });
    return {
      movies: moviesRes.data.length,
      downloading: queueRes.data.length,
    };
  } catch (e) {
    throw new Error(`Radarr status failed: ${e.message}`);
  }
}
