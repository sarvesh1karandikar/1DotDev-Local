import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b";

const ANALYZER_PROMPT = `You analyze a WhatsApp message and decide which AI model should execute it.

Analyze the message for:
1. Sentiment: frustrated, happy, neutral, urgent
2. Complexity: simple (1-step), medium (2-3 steps), complex (reasoning needed)
3. Task type: action (add/search/tool), chat (conversation), memory (remember/recall)
4. Multi-step: is this a multi-part request?

Based on analysis, decide which model:
- "local" = Use local Llama (simple actions, quick responses, cost-saving)
- "haiku" = Use Haiku 4.5 (tool routing, emotional support, most versatile)
- "sonnet" = Use Sonnet 4.5 (complex reasoning, multi-step planning, context synthesis)

Respond in JSON only:
{
  "sentiment": "frustrated|happy|neutral|urgent",
  "complexity": "simple|medium|complex",
  "task_type": "action|chat|memory",
  "is_multistep": true|false,
  "model": "local|haiku|sonnet",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

export async function analyzeQuery(userMessage) {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: `${ANALYZER_PROMPT}\n\nMessage: "${userMessage}"\n\nAnalysis:`,
      stream: false,
      temperature: 0.3,
    }, { timeout: 10000 });

    const responseText = response.data.response || "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("analyzer: no JSON in response, defaulting to haiku");
      return defaultDecision("local", "no analysis");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return {
      ...analysis,
      timestamp: Date.now(),
      source: "local_analyzer",
    };
  } catch (e) {
    console.warn("router-analyzer error:", e.message);
    return defaultDecision("haiku", `analyzer failed: ${e.message}`);
  }
}

function defaultDecision(model, reason) {
  return {
    sentiment: "neutral",
    complexity: "medium",
    task_type: "chat",
    is_multistep: false,
    model,
    confidence: 0.0,
    reason,
    timestamp: Date.now(),
    source: "fallback",
  };
}

// Model execution mapping
export const MODEL_EXECUTORS = {
  local: {
    name: "claude-haiku-4-5", // fallback to haiku if local unavailable
    type: "local_or_haiku",
  },
  haiku: {
    name: "claude-haiku-4-5",
    type: "api",
  },
  sonnet: {
    name: "claude-sonnet-4-6",
    type: "api",
  },
};
