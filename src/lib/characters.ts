export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "void";

export type Character = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Clean transparent idle portrait — the only sprite used in games. */
  idle: string;
  points: number;
  accent: string;
};

// bump when clean sprites are regenerated so clients don't keep stale PNGs
// BASE_URL prefix: public-dir absolute paths bypass Vite's `base`, so the
// subpath deploy (ARCADE_BASE=/arcade/) must add its own prefix here.
const CLEAN = import.meta.env.BASE_URL.replace(/\/$/, "") + "/characters/clean";
const V = "v4";

function char(
  id: string,
  name: string,
  rarity: Rarity,
  points: number,
  accent: string,
): Character {
  return {
    id,
    name,
    rarity,
    idle: `${CLEAN}/${id}_idle.png?${V}`,
    points,
    accent,
  };
}

export const CHARACTERS: Character[] = [
  char("street-handler", "Street Handler", "common", 10, "#3ecbff"),
  char("pocket-slime", "Pocket Slime", "common", 10, "#a78bfa"),
  char("deck-runner", "Deck Runner", "common", 12, "#ff4d6d"),
  char("cyber-chick", "Cyber Chick", "common", 10, "#f5e642"),
  char("kiosk-clerk", "Kiosk Clerk", "common", 10, "#9b8fb8"),
  char("glass-kitten", "Glass Kitten", "common", 12, "#3ecbff"),
  char("patch-hacker", "Patch Hacker", "common", 12, "#ff6bcb"),
  char("spark-beetle", "Spark Beetle", "common", 10, "#3ecbff"),
  char("circuit-weaver", "Circuit Weaver", "uncommon", 25, "#3dff9a"),
  char("splice-fox", "Splice Fox", "uncommon", 25, "#ff4d6d"),
  char("vault-analyst", "Vault Analyst", "uncommon", 25, "#ff9f1c"),
  char("axolotl", "Bio Axolotl", "uncommon", 30, "#ff6bcb"),
  char("subnet-courier", "Sub-Net Courier", "uncommon", 25, "#3ecbff"),
  char("black-gold", "Black Gold Exec", "rare", 50, "#f5e642"),
  char("prism-lynx", "Prism Lynx", "rare", 50, "#a78bfa"),
  char("void-nav", "Void Navigator", "rare", 55, "#3ecbff"),
  char("eclipse-dragon", "Eclipse Hatchling", "rare", 60, "#a78bfa"),
  char("arch-weave", "Arch Weave Master", "legendary", 100, "#f5e642"),
  char("chimera", "Singularity Chimera", "legendary", 120, "#c084fc"),
  char("apex", "Apex Sovereign", "mythic", 200, "#f5e642"),
  char("void", "VOID", "void", 250, "#3dff9a"),
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9b8fb8",
  uncommon: "#3dff9a",
  rare: "#3ecbff",
  legendary: "#f5e642",
  mythic: "#ff9f1c",
  void: "#c084fc",
};

export function pickWeightedCharacter(rng = Math.random): Character {
  const weights = CHARACTERS.map((c) => {
    switch (c.rarity) {
      case "common":
        return 40;
      case "uncommon":
        return 25;
      case "rare":
        return 12;
      case "legendary":
        return 5;
      case "mythic":
        return 2;
      case "void":
        return 1;
    }
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < CHARACTERS.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return CHARACTERS[i]!;
  }
  return CHARACTERS[0]!;
}

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit?.complete && hit.naturalWidth > 0) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function preloadCharacters(list: Character[] = CHARACTERS): Promise<void> {
  await Promise.all(list.map((c) => loadImage(c.idle).catch(() => null)));
}

/** Draw idle portrait (transparent PNG). */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}
