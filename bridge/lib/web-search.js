import axios from "axios";

const SEARXNG_URL = process.env.SEARXNG_URL || "https://searxng.railway.app";

export async function search(query, limit = 5) {
  try {
    const res = await axios.get(`${SEARXNG_URL}/search`, {
      params: {
        q: query,
        format: "json",
        pageno: 1,
      },
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const results = res.data.results || [];
    return results.slice(0, limit).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 150),
    }));
  } catch (e) {
    throw new Error(`Searxng search failed: ${e.message}`);
  }
}
