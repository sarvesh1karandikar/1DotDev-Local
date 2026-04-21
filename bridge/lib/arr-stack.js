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

/**
 * Fetch available quality profiles from Sonarr or Radarr
 * @param {string} arrUrl - The arr stack URL (e.g., http://localhost:8989)
 * @param {string} apiKey - The arr stack API key
 * @param {string} arrType - Either "sonarr" or "radarr"
 * @returns {Promise<Array>} Array of quality profile objects with id and name
 */
export async function getQualityProfiles(arrUrl, apiKey, arrType) {
  try {
    const res = await axios.get(`${arrUrl}/api/v3/qualityprofile`, {
      headers: headers(apiKey),
      timeout: 10000,
    });

    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`No quality profiles found in ${arrType}`);
    }

    return res.data.map(profile => ({
      id: profile.id,
      name: profile.name,
    }));
  } catch (e) {
    if (e.response?.status === 401) {
      throw new Error(`${arrType} API authentication failed: Invalid API key`);
    }
    if (e.response?.status === 404) {
      throw new Error(`${arrType} quality profile endpoint not found: ${arrUrl}/api/v3/qualityprofile`);
    }
    throw new Error(
      `Failed to fetch ${arrType} quality profiles: ${e.response?.data?.message || e.message}`
    );
  }
}

/**
 * Fetch available root folders from Sonarr or Radarr
 * @param {string} arrUrl - The arr stack URL (e.g., http://localhost:8989)
 * @param {string} apiKey - The arr stack API key
 * @param {string} arrType - Either "sonarr" or "radarr"
 * @returns {Promise<Array>} Array of root folder objects with path and freeSpace
 */
export async function getRootFolders(arrUrl, apiKey, arrType) {
  try {
    const res = await axios.get(`${arrUrl}/api/v3/rootfolder`, {
      headers: headers(apiKey),
      timeout: 10000,
    });

    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error(`No root folders configured in ${arrType}`);
    }

    return res.data.map(folder => ({
      path: folder.path,
      freeSpace: folder.freeSpace,
    }));
  } catch (e) {
    if (e.response?.status === 401) {
      throw new Error(`${arrType} API authentication failed: Invalid API key`);
    }
    if (e.response?.status === 404) {
      throw new Error(`${arrType} root folder endpoint not found: ${arrUrl}/api/v3/rootfolder`);
    }
    throw new Error(
      `Failed to fetch ${arrType} root folders: ${e.response?.data?.message || e.message}`
    );
  }
}

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
    // Fetch available quality profiles from Sonarr
    let qualityProfileId;
    try {
      const profiles = await getQualityProfiles(SONARR_URL, SONARR_API_KEY, "Sonarr");
      qualityProfileId = profiles[0].id;
    } catch (profileError) {
      throw new Error(
        `Cannot add series - Quality profile fetch failed: ${profileError.message}. ` +
        `Please ensure at least one quality profile is configured in Sonarr.`
      );
    }

    const res = await axios.post(`${SONARR_URL}/api/v3/series`, {
      tvdbId,
      qualityProfileId,
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
    // Fetch available quality profiles from Radarr
    let qualityProfileId;
    try {
      const profiles = await getQualityProfiles(RADARR_URL, RADARR_API_KEY, "Radarr");
      qualityProfileId = profiles[0].id;
    } catch (profileError) {
      throw new Error(
        `Cannot add movie - Quality profile fetch failed: ${profileError.message}. ` +
        `Please ensure at least one quality profile is configured in Radarr.`
      );
    }

    const res = await axios.post(`${RADARR_URL}/api/v3/movie`, {
      tmdbId,
      qualityProfileId,
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
