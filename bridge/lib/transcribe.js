import axios from "axios";

const WHISPER_API_URL = process.env.WHISPER_API_URL || "http://localhost:8200/v1";
const WHISPER_API_KEY = process.env.WHISPER_API_KEY || "";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "whisper-large-v3";

export async function transcribe(audioBuffer, mimeType = "audio/ogg") {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "wav";
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
  form.append("model", WHISPER_MODEL);

  const headers = {};
  if (WHISPER_API_KEY) headers.Authorization = `Bearer ${WHISPER_API_KEY}`;

  const resp = await axios.post(`${WHISPER_API_URL}/audio/transcriptions`, form, {
    headers,
    timeout: 30000,
  });

  return resp.data.text || "";
}
