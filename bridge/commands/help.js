const FEATURE_CATEGORIES = [
  {
    emoji: "📺",
    title: "Streaming & Downloads",
    description: "Find and download shows and movies",
    examples: [
      '"I want to watch Breaking Bad"',
      '"download The Office"',
      '"what shows do we have"',
      '"stream The Last of Us"',
    ],
  },
  {
    emoji: "📅",
    title: "Reminders & To-dos",
    description: "Set reminders and manage tasks",
    examples: [
      '"remind me to call mom tomorrow at 3pm"',
      '"todo buy groceries"',
      '"what are my reminders"',
    ],
  },
  {
    emoji: "🧠",
    title: "Memory & Personality",
    description: "I learn about you and remember facts",
    examples: [
      '"I am vegetarian"',
      '"I prefer subtitles"',
      '"what do you know about me"',
    ],
  },
  {
    emoji: "🗒️",
    title: "Notes & Journaling",
    description: "Save quick notes and journal entries",
    examples: [
      '"note: tried a new pasta recipe"',
      '"journal: great day at work"',
      '"my notes from today"',
    ],
  },
  {
    emoji: "🔍",
    title: "Search & Information",
    description: "Search the web for anything",
    examples: [
      '"search for Python tutorials"',
      '"latest AI news"',
      '"best restaurants nearby"',
    ],
  },
  {
    emoji: "🕐",
    title: "Time & Scheduling",
    description: "Check time, set timezones, schedule tasks",
    examples: [
      '"what time is it in Tokyo"',
      '"my timezone is EST"',
      '"remind me in 2 hours"',
    ],
  },
];

const GROUP_ORDER = [
  { key: "reminders", label: "📅 Reminders & todos" },
  { key: "time",      label: "🕐 Time" },
  { key: "notes",     label: "🗒️  Notes" },
  { key: "journal",   label: "📓 Journal" },
  { key: "memory",    label: "🧠 Memory" },
  { key: "media",     label: "📺 Media" },
  { key: "search",    label: "🔍 Search" },
  { key: "settings",  label: "⚙️  Settings" },
  { key: "stats",     label: "📊 Stats & admin" },
  { key: "admin",     label: "🛡️  Admin tools" },
  { key: "core",      label: "🧹 Utility" },
];

function groupCommands(cmds) {
  const groups = new Map(GROUP_ORDER.map(g => [g.key, []]));
  for (const cmd of cmds) {
    const key = cmd.category ?? "core";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cmd);
  }
  return groups;
}

function renderCommandList(title, cmds) {
  const groups = groupCommands(cmds);
  const lines = [title, ""];
  for (const g of GROUP_ORDER) {
    const inGroup = groups.get(g.key) ?? [];
    if (inGroup.length === 0) continue;
    lines.push(g.label);
    for (const cmd of inGroup) {
      lines.push(`  /${cmd.name} — ${cmd.description}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function renderCapabilities(commands) {
  const lines = ["*1DotDev Bot — What Can I Do?*", ""];
  lines.push("I understand natural language. Just talk to me like a person—no slash commands needed.");
  lines.push("");

  for (const cat of FEATURE_CATEGORIES) {
    lines.push(`${cat.emoji} *${cat.title}*`);
    lines.push(`  ${cat.description}`);
    for (const ex of cat.examples) {
      lines.push(`    • ${ex}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("*💡 Pro Tips:*");
  lines.push("  • Slash commands work too (e.g., /remind, /add-series)");
  lines.push("  • Type /help <feature> to see detailed commands");
  lines.push("  • Just message naturally—I'll figure it out");
  lines.push("");
  lines.push("*Need command details?* Type: /help-detailed");

  return lines.join("\n");
}

function renderDetail(cmd) {
  const lines = [`*/${cmd.name}*`, ""];
  if (cmd.usage) lines.push(`Usage: ${cmd.usage}`, "");
  lines.push(cmd.description);
  if (cmd.details) lines.push("", cmd.details);
  if (cmd.examples?.length) {
    lines.push("", "Examples:");
    for (const ex of cmd.examples) lines.push(`  ${ex}`);
  }
  return lines.join("\n");
}

export default {
  name: "help",
  adminOnly: false,
  category: "core",
  description: "Show what I can do",
  usage: "/help [command or feature]",
  async run({ isAdmin, commands, args }) {
    const arg = args.trim().replace(/^\//, "").toLowerCase();

    // Check if user wants detailed command list
    if (arg === "detailed" || arg === "commands") {
      const visible = commands.filter(c => !c.adminOnly && !c.hidden);
      return renderCommandList("*1DotDev Bot — Detailed Command Reference*", visible);
    }

    // Check if user wants specific command details
    if (arg) {
      const cmd = commands.find(c => c.name === arg);
      if (cmd) {
        if (cmd.adminOnly && !isAdmin) return `/${arg} is admin-only.`;
        return renderDetail(cmd);
      }
      // Not a command, maybe they want help about the feature
      const feature = FEATURE_CATEGORIES.find(f =>
        f.title.toLowerCase().includes(arg) ||
        f.description.toLowerCase().includes(arg)
      );
      if (feature) {
        return [
          `*${feature.emoji} ${feature.title}*`,
          "",
          feature.description,
          "",
          "Examples of what you can say:",
          ...feature.examples.map(ex => `  • ${ex}`),
        ].join("\n");
      }
      return `No command or feature called "${arg}". Type /help to see everything I can do.`;
    }

    // Main help view
    if (isAdmin) {
      const userFacing = commands.filter(c => !c.adminOnly && !c.hidden);
      const hiddenOrAdmin = commands.filter(c => c.adminOnly || c.hidden);
      return [
        renderCapabilities(userFacing),
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        renderCommandList("*Admin-only / hidden commands*", hiddenOrAdmin),
      ].join("\n");
    }

    return renderCapabilities(commands);
  },
};
