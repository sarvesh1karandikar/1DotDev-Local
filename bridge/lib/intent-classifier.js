// Intent-based routing classifier: Maps natural language to tool intentions
// Returns { toolName, args, confidence } or null if uncertain
// Confidence ranges from 0 to 1, higher is more certain

const INTENT_PATTERNS = [
  // Explicit "add movie" requests (highest priority - check before series)
  {
    keywords: ["add", "movie", "film"],
    negativeKeywords: ["series", "show", "tv"],
    action: "add_movie",
    extractor: extractMovieTitle,
    confidence: 0.95,
  },
  // Explicit "add series" requests (high priority)
  {
    keywords: ["add", "series", "show"],
    action: "add_series",
    extractor: extractShowTitle,
    confidence: 0.95,
  },
  // Reset/Clear (high confidence patterns)
  {
    patterns: [/(?:clear|reset)(?:\s+(?:my|the))?\s+(?:chat\s+)?history/, /forget\s+everything/],
    action: "reset",
    confidence: 0.95,
  },
  // Time (specific patterns)
  {
    patterns: [/what's?\s+the\s+time/, /current\s+time/, /what\s+time\s+is\s+it/],
    action: "time",
    confidence: 0.95,
  },
  // Reminders List (specific patterns)
  {
    patterns: [/(?:my\s+)?reminders(?:\s+list)?$/, /(?:show|list)\s+my\s+reminders/],
    action: "reminders_list",
    confidence: 0.92,
  },
  // Todo List (specific patterns)
  {
    patterns: [/(?:my\s+)?(?:todo|to-do|task)s?\s*(?:list)?$/, /(?:show|list)\s+(?:my\s+)?(?:todo|to-do|task)s?/],
    action: "todo_list",
    confidence: 0.9,
  },
  // Media Status (specific patterns)
  {
    patterns: [/(?:media\s+)?status$/, /what's?\s+(?:downloading|down)/i],
    action: "media_status",
    confidence: 0.9,
  },
  // Todo Add (explicit keywords)
  {
    keywords: ["task", "todo", "to-do"],
    negativeKeywords: ["done", "complete", "finish", "mark", "remove", "delete"],
    action: "todo_add",
    extractor: extractTodo,
    confidence: 0.88,
  },
  // Reminders (explicit keywords)
  {
    keywords: ["remind", "reminder"],
    action: "remind",
    extractor: extractReminder,
    confidence: 0.87,
  },
  // Todo Done (explicit keywords with qualifier)
  {
    keywords: ["done", "complete", "finish"],
    qualifier: ["todo", "task", "to-do"],
    action: "todo_done",
    extractor: extractTodoIndex,
    confidence: 0.85,
  },
  // Explicit "search series" requests
  {
    keywords: ["search", "find"],
    qualifier: ["series", "show"],
    action: "search_series",
    extractor: extractSearchQuery,
    confidence: 0.85,
  },
  // Explicit "search movie" requests
  {
    keywords: ["search", "find"],
    qualifier: ["movie", "film"],
    action: "search_movie",
    extractor: extractSearchQuery,
    confidence: 0.85,
  },
  // Digest Add
  {
    keywords: ["digest", "add", "subscribe", "track"],
    qualifier: ["digest", "news"],
    action: "digest_add",
    extractor: extractDigestTopic,
    confidence: 0.82,
  },
  // Watch/Download (ambiguous - prefer add_series)
  {
    keywords: ["watch", "download"],
    negativeKeywords: ["not", "don't", "stop"],
    action: "add_series",
    extractor: extractShowTitle,
    confidence: 0.8,
  },
  // Web Search (catch-all for questions - lowest priority)
  {
    keywords: ["what", "who", "when", "where", "why", "how", "search", "look", "news", "current", "latest"],
    negativeKeywords: ["series", "show", "movie", "film", "tv", "episode", "todo", "task", "time"],
    action: "search_web",
    extractor: extractWebSearchQuery,
    confidence: 0.65,
  },
  // Fallback: bare title (2+ words, no special chars - assume TV series by default)
  // "Breaking Bad" -> add_series with 0.6 confidence
  {
    patterns: [/^[a-z][a-z0-9\s&'-]*[a-z0-9]$/i],
    negativeKeywords: ["what", "how", "who", "when", "where", "why", "?", "!"],
    action: "add_series",
    extractor: extractShowTitle,
    confidence: 0.6,
  },
];

/**
 * Classifies user intent from natural language message
 * Returns { toolName, args, confidence, method } or null
 */
export function classifyIntent(userMessage) {
  if (!userMessage || typeof userMessage !== "string") return null;

  const msg = userMessage.toLowerCase().trim();
  if (msg.length === 0) return null;

  // Check each intent pattern (in order of precedence)
  for (const pattern of INTENT_PATTERNS) {
    const match = matchPattern(msg, pattern);
    if (match) {
      let args = "";
      if (pattern.extractor) {
        args = pattern.extractor(msg) || "";
      }
      return {
        toolName: pattern.action,
        args,
        confidence: pattern.confidence,
        method: "pattern",
      };
    }
  }

  return null;
}

/**
 * Matches a message against an intent pattern
 */
function matchPattern(msg, pattern) {
  // Check explicit regex patterns first (highest priority)
  if (pattern.patterns && pattern.patterns.length > 0) {
    if (pattern.patterns.some(p => p.test(msg))) {
      return true;
    }
  }

  // Check keywords presence
  if (pattern.keywords && pattern.keywords.length > 0) {
    const hasKeyword = pattern.keywords.some(kw => msg.includes(kw));
    if (!hasKeyword) return false;

    // Check negative keywords (blockers)
    if (pattern.negativeKeywords && pattern.negativeKeywords.length > 0) {
      const hasNegative = pattern.negativeKeywords.some(nkw => msg.includes(nkw));
      if (hasNegative) return false;
    }

    // Check qualifier keywords if present
    if (pattern.qualifier && pattern.qualifier.length > 0) {
      const hasQualifier = pattern.qualifier.some(q => msg.includes(q));
      if (!hasQualifier) return false;
    }

    return true;
  }

  return false;
}

/**
 * Extract show title from messages like "breaking bad" or "add series breaking bad"
 */
function extractShowTitle(msg) {
  // Remove common action words and prefixes
  let text = msg.replace(/^(?:add|watch|download|get|find|show me|i want to watch)\s+(?:series|show|tv|the\s+)?/i, "").trim();
  text = text.replace(/\s+(?:series|show|tv)?\s*$/, "").trim();

  // Remove quotation marks if present
  text = text.replace(/^["']|["']$/g, "").trim();

  // Take first 100 chars, trim to last complete word
  if (text.length > 100) {
    text = text.substring(0, 100).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Extract movie title from messages like "inception" or "add movie the matrix"
 */
function extractMovieTitle(msg) {
  // Remove common action words
  let text = msg.replace(/^(?:add|watch|download|get|find|show me|i want to watch)\s+(?:movie|film|flick|the\s+)?/i, "").trim();
  text = text.replace(/\s+(?:movie|film|flick)?\s*$/, "").trim();

  // Remove quotation marks if present
  text = text.replace(/^["']|["']$/g, "").trim();

  // Take first 100 chars
  if (text.length > 100) {
    text = text.substring(0, 100).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Extract search query from messages like "shows like breaking bad"
 */
function extractSearchQuery(msg) {
  // Remove keywords like "search", "find", "recommend"
  let text = msg.replace(/^(?:search|find|look\s+(?:for|up)|recommend|suggest|similar|like)\s+(?:for\s+)?(?:series|shows?|movies?|films?)?\s*/, "").trim();
  text = text.replace(/\s+(?:series|show|movie|film|similar|like)\s*$/, "").trim();

  if (text.length > 150) {
    text = text.substring(0, 150).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Extract reminder timing and text from messages like "remind me tomorrow to call mom"
 */
function extractReminder(msg) {
  // Try to match various reminder formats
  // "remind me [when] [to] [what]"
  // "reminder [when] to [what]"
  // "set a reminder [when] [to] [what]"

  const patterns = [
    /(?:remind|reminder|set\s+a\s+reminder)\s+(?:me\s+)?(?:(tomorrow|today|tonight|in\s+\d+\s+(?:hours?|minutes?|days?)|at\s+\d+(?:am|pm)|\d{1,2}:\d{2}|later|soon))?[\s:]*(?:to\s+)?(.+)/i,
    /(?:remind|reminder)\s+(?:me\s+)?(to\s+.+?)(?:\s+(?:at|on|in|tomorrow|today|tonight))?/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      const when = (match[1] || "soon").trim();
      const text = (match[2] || "").trim();
      if (text && text.length > 1) {
        return `${when} ${text}`;
      }
    }
  }

  return "";
}

/**
 * Extract todo text from messages like "add milk to shopping list" or "task: call mom"
 */
function extractTodo(msg) {
  // Remove leading action keywords
  let text = msg
    .replace(/^(?:add|note|remember|don't\s+forget|task|todo|to-do)\s*[:]*\s*(?:to\s+(?:my\s+)?)?(?:todo|to-do|list|tasks?)?[\s:]*/, "i")
    .trim();

  // Remove trailing keywords
  text = text.replace(/\s+(?:to\s+(?:my\s+)?)?(?:todo|to-do|list|tasks?)?\s*$/i, "").trim();

  if (text.length > 200) {
    text = text.substring(0, 200).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Extract todo index from messages like "mark #1 done" or "complete task 3"
 */
function extractTodoIndex(msg) {
  // Look for #N or "number N" or "task N"
  const indexMatch = msg.match(/#?(\d+)|(?:todo|task)\s+#?(\d+)/i);
  if (indexMatch) {
    const idx = indexMatch[1] || indexMatch[2];
    return idx ? String(parseInt(idx)) : "";
  }
  return "";
}

/**
 * Extract web search query from messages
 */
function extractWebSearchQuery(msg) {
  // Remove question words and search keywords
  let text = msg
    .replace(/^(?:search|look\s+up|find|what|who|when|where|why|how|is|are|do|does|latest\s+|news\s+(?:about|on|for)?|current[^a-z]*)\s+(?:for\s+)?(?:is\s+(?:the\s+)?)?/i, "")
    .trim();

  // Remove trailing punctuation
  text = text.replace(/[?!.]+$/, "").trim();

  if (text.length > 200) {
    text = text.substring(0, 200).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Extract digest topic from messages like "add AI news to digest" or "subscribe to crypto"
 */
function extractDigestTopic(msg) {
  // Remove digest action keywords
  let text = msg
    .replace(/^(?:add|subscribe|track|follow)\s+(?:to\s+)?(?:(?:my\s+)?(?:digest|news))?\s*[:]*\s*/i, "")
    .trim();

  // Remove trailing keywords
  text = text.replace(/\s+(?:to\s+)?(?:digest|news)?\s*$/i, "").trim();

  if (text.length > 100) {
    text = text.substring(0, 100).split(" ").slice(0, -1).join(" ");
  }

  return text || "";
}

/**
 * Test function: returns confidence and method for a given message
 */
export function testClassification(userMessage) {
  const result = classifyIntent(userMessage);
  if (result) {
    return {
      message: userMessage,
      toolName: result.toolName,
      args: result.args,
      confidence: result.confidence,
      method: result.method,
    };
  }
  return { message: userMessage, matched: false };
}
