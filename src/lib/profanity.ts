/**
 * Lightweight callsign filter for arcade leaderboards.
 * Client + server; blocks slurs, sexual crude, and collapsed phrase variants
 * (e.g. "suckmynut", "f.u.c.k", "a$$").
 */

/** Full / multi-char tokens matched as substrings after normalize (len ≥ 4 preferred). */
const BLOCKED = [
  // core profanity
  "asshole",
  "assholes",
  "bastard",
  "bitch",
  "bitches",
  "bollocks",
  "bullshit",
  "cock",
  "cocks",
  "cunt",
  "damn",
  "dick",
  "dicks",
  "fag",
  "faggot",
  "fags",
  "fuck",
  "fucked",
  "fucker",
  "fuckers",
  "fucking",
  "fucks",
  "goddamn",
  "jizz",
  "kike",
  "nazi",
  "nigga",
  "nigger",
  "piss",
  "porn",
  "pussy",
  "rape",
  "rapist",
  "retard",
  "retarded",
  "shit",
  "shits",
  "shitty",
  "slut",
  "spic",
  "tits",
  "twat",
  "wank",
  "wanker",
  "whore",
  // sexual / crude body
  "penis",
  "vagina",
  "boob",
  "boobs",
  "booty",
  "buttsex",
  "anal",
  "anus",
  "semen",
  "sperm",
  "orgasm",
  "nude",
  "nudes",
  "horny",
  "hentai",
  "dildo",
  "blowjob",
  "handjob",
  "rimjob",
  "cumshot",
  "creampie",
  // verb / act slang
  "suck",
  "sucks",
  "sucked",
  "sucking",
  "sucker",
  "lick",
  "licks",
  "licked",
  "licking",
  "fuckme",
  "fukme",
  // leetspeak spellings (normalize strips digits/symbols too)
  "fuk",
  "fck",
  "fuc",
  "sh1t",
  "b1tch",
  "a55hole",
  "d1ck",
  "n1gger",
  "n1gga",
];

/** Short tokens: only exact match or whole-word-ish edges after normalize. */
const SHORT_BLOCKED = ["ass", "cum", "tit", "sex", "fag", "god"];

/**
 * Multi-part sexual/crude phrases after spaces/punctuation are stripped.
 * Catches "suck my nut", "suckmynut", "my-dick", etc.
 */
const PHRASE_PATTERNS: RegExp[] = [
  /suck.*my/,
  /my.*suck/,
  /suck.*nut/,
  /nut.*suck/,
  /my.*nut/,
  /nut.*my/,
  /my.*dick/,
  /dick.*my/,
  /my.*cock/,
  /cock.*my/,
  /my.*ball/,
  /ball.*my/,
  /my.*ass/,
  /ass.*my/,
  /eat.*ass/,
  /ass.*eat/,
  /blow.*me/,
  /me.*blow/,
  /lick.*my/,
  /my.*lick/,
  /fuck.*me/,
  /me.*fuck/,
  /fuck.*you/,
  /you.*fuck/,
  /fuck.*off/,
  /sit.*face/,
  /face.*sit/,
  /deep.*throat/,
  /throat.*deep/,
  /big.*dick/,
  /dick.*big/,
  /hard.*cock/,
  /cock.*hard/,
  /hot.*cum/,
  /cum.*on/,
  /on.*cum/,
  /jerk.*off/,
  /jack.*off/,
  /get.*naked/,
  /show.*tit/,
  /show.*boob/,
  /suck.*dick/,
  /dick.*suck/,
  /suck.*cock/,
  /cock.*suck/,
  /suck.*ball/,
  /ball.*suck/,
  /nut.*in/,
  /in.*nut/,
  /bust.*nut/,
  /nut.*bust/,
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "*": "",
  ".": "",
  _: "",
  "-": "",
  " ": "",
};

/** Collapse leetspeak / separators so "f.u.c.k" and "suck my nut" still match. */
export function normalizeCallsign(raw: string): string {
  const lower = raw.toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (LEET[ch] !== undefined) out += LEET[ch];
    else if (/[a-z]/.test(ch)) out += ch;
  }
  // collapse repeated letters a bit: "suuuck" → "suuck" still has suck; "fuuuck" → help match
  // light pass: 3+ same letter → 2
  return out.replace(/(.)\1{2,}/g, "$1$1");
}

function hasBlockedToken(normalized: string): boolean {
  for (const word of BLOCKED) {
    const w = word.replace(/[^a-z]/g, "");
    if (!w) continue;
    if (normalized === w || normalized.includes(w)) return true;
  }

  for (const w of SHORT_BLOCKED) {
    if (normalized === w) return true;
    // edge match only (start/end) to limit false positives like "class"/"title"
    if (normalized.startsWith(w) || normalized.endsWith(w)) {
      if (w === "ass" && /(class|pass|mass|bass|glass|assassin|compass)/.test(normalized)) continue;
      if (w === "tit" && /(title|spirit|attitude|partition|constitution)/.test(normalized)) continue;
      if (w === "cum" && /(document|cucumber|accumulate|circum)/.test(normalized)) continue;
      if (w === "sex" && /(sussex|essex|sexton)/.test(normalized)) continue;
      if (w === "god" && /(godot|goddess|good)/.test(normalized)) continue;
      return true;
    }
    // mid-string for short sexual words only when sandwiched with other letters
    // e.g. still catch xcumy if needed via phrase patterns mostly
  }

  for (const re of PHRASE_PATTERNS) {
    if (re.test(normalized)) return true;
  }

  return false;
}

export type CallsignCheck =
  | { ok: true; name: string }
  | { ok: false; reason: string };

/** Validate + clean a leaderboard callsign. */
export function checkCallsign(raw: string): CallsignCheck {
  const trimmed = raw.trim().slice(0, 16);
  if (!trimmed) return { ok: false, reason: "Enter a callsign." };
  if (!/^[a-zA-Z0-9_\- .]+$/.test(trimmed)) {
    return { ok: false, reason: "Letters, numbers, spaces, _ or - only." };
  }
  const norm = normalizeCallsign(trimmed);
  if (norm.length < 1) return { ok: false, reason: "Enter a callsign." };
  if (hasBlockedToken(norm)) {
    return { ok: false, reason: "That callsign isn't allowed. Try another." };
  }
  return { ok: true, name: trimmed };
}
