import axios from "axios";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function sendText(to, text) {
  const { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID } = process.env;
  await axios.post(
    `${GRAPH_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: { Authorization: `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" } }
  );
}

export async function downloadMedia(mediaId) {
  const { META_WA_TOKEN } = process.env;
  const authHeaders = { Authorization: `Bearer ${META_WA_TOKEN}` };
  const metaResp = await axios.get(`${GRAPH_BASE}/${mediaId}`, { headers: authHeaders });
  const mediaResp = await axios.get(metaResp.data.url, {
    headers: authHeaders,
    responseType: "arraybuffer",
  });
  return {
    buffer: Buffer.from(mediaResp.data),
    mimeType: metaResp.data.mime_type || "audio/ogg",
  };
}

export async function sendTemplate(to, templateName, language, bodyParams = []) {
  const { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID } = process.env;
  const components = bodyParams.length > 0
    ? [{
        type: "body",
        parameters: bodyParams.map(p => ({ type: "text", text: p })),
      }]
    : [];
  await axios.post(
    `${GRAPH_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: language }, components },
    },
    { headers: { Authorization: `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" } }
  );
}
