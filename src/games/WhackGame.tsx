import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { useGameLoop } from "@/games/useGameLoop";
import {
  CHARACTERS,
  drawSprite,
  loadImage,
  pickWeightedCharacter,
  RARITY_COLOR,
  type Character,
} from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";

type Hole = {
  x: number;
  y: number;
  r: number;
  char: Character | null;
  phase: number;
  life: number;
  maxLife: number;
  hit: boolean;
  glow: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Floater = { x: number; y: number; t: number; pts: number; color: string };

const meta = getGame("whack")!;
const COLS = 3;
const ROWS = 3;
const DURATION = 45;

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(62,203,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function rarityNeon(rarity: Character["rarity"]): string {
  switch (rarity) {
    case "common":
      return "#3ecbff";
    case "uncommon":
      return "#3dff9a";
    case "rare":
      return "#7c5cff";
    case "legendary":
      return "#f5e642";
    case "mythic":
      return "#ff6b2b";
    case "void":
      return "#ff2bd6";
    default:
      return "#3ecbff";
  }
}

export function WhackGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("whack"));
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    holes: [] as Hole[],
    score: 0,
    timeLeft: DURATION,
    spawnCd: 0,
    idleImgs: new Map<string, HTMLImageElement>(),
    readyIds: new Set<string>(),
    combo: 0,
    flashes: [] as Floater[],
    sparks: [] as Spark[],
    time: 0,
    shake: 0,
    preloadStarted: false,
  });

  /** Load every agent portrait up front so spawns never show a circle placeholder. */
  const preloadAll = () => {
    const s = state.current;
    if (s.preloadStarted) return;
    s.preloadStarted = true;
    for (const char of CHARACTERS) {
      loadImage(char.idle)
        .then((img) => {
          s.idleImgs.set(char.id, img);
          s.readyIds.add(char.id);
        })
        .catch(() => {
          /* skip broken asset */
        });
    }
  };

  useEffect(() => {
    preloadAll();
  }, []);

  const layoutHoles = (w: number, h: number) => {
    const holes: Hole[] = [];
    const padX = 18;
    const padTop = 52;
    const padBot = 22;
    const cellW = (w - padX * 2) / COLS;
    const cellH = (h - padTop - padBot) / ROWS;
    const r = Math.min(cellW, cellH) * 0.34;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        holes.push({
          x: padX + cellW * col + cellW / 2,
          y: padTop + cellH * row + cellH * 0.64,
          r,
          char: null,
          phase: 0,
          life: 0,
          maxLife: 1,
          hit: false,
          glow: 0,
        });
      }
    }
    state.current.holes = holes;
  };

  const burst = (x: number, y: number, color: string, power = 1) => {
    const s = state.current;
    const n = Math.floor(8 + power * 10);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 180 * power;
      s.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        color,
        size: 1.5 + Math.random() * 3 * power,
      });
    }
  };

  const pickReadyCharacter = (): Character | null => {
    const ready = state.current.readyIds;
    if (ready.size === 0) return null;
    // Prefer weighted pick among ready only (retry a few times)
    for (let i = 0; i < 12; i++) {
      const c = pickWeightedCharacter();
      if (ready.has(c.id) && state.current.idleImgs.has(c.id)) return c;
    }
    // Fallback: any ready char
    const ids = [...ready];
    const id = ids[Math.floor(Math.random() * ids.length)]!;
    return CHARACTERS.find((c) => c.id === id) ?? null;
  };

  const start = () => {
    preloadAll();
    const canvas = canvasRef.current;
    layoutHoles(canvas?.clientWidth || 360, canvas?.clientHeight || 520);
    state.current.score = 0;
    state.current.timeLeft = DURATION;
    state.current.spawnCd = 0.35;
    state.current.combo = 0;
    state.current.flashes = [];
    state.current.sparks = [];
    state.current.shake = 0;
    state.current.time = 0;
    setScore(0);
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("whack", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  const agentCenter = (hole: Hole) => {
    const pop = hole.phase;
    const size = hole.r * 2.2 * Math.min(1, 0.55 + pop * 0.5);
    // Stand on platform deck: feet sit just above pad surface
    const deckY = hole.y - hole.r * 0.22;
    const rise = (1 - pop) * hole.r * 0.85;
    const cx = hole.x;
    const cy = deckY - size * 0.48 - rise;
    return { cx, cy, size, deckY };
  };

  const hitAt = (clientX: number, clientY: number) => {
    if (statusRef.current !== "playing") {
      if (statusRef.current === "ready") start();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = state.current;
    for (const hole of s.holes) {
      if (!hole.char || hole.hit || hole.phase < 0.35) continue;
      // Don't score hits until sprite is actually drawn
      if (!s.idleImgs.has(hole.char.id)) continue;
      const { cx, cy, size } = agentCenter(hole);
      const dx = x - cx;
      const dy = y - cy;
      const hitR = size * 0.48;
      if (dx * dx + dy * dy <= hitR * hitR) {
        hole.hit = true;
        const neon = rarityNeon(hole.char.rarity);
        const mult = 1 + Math.floor(s.combo / 3) * 0.25;
        const pts = Math.round(hole.char.points * mult);
        s.score += pts;
        s.combo += 1;
        setScore(s.score);
        s.flashes.push({ x: cx, y: cy - size * 0.35, t: 0.65, pts, color: neon });
        burst(cx, cy, neon, 1.1);
        s.shake = Math.min(1, s.shake + 0.35);
        hole.glow = 1;
        hole.phase = 0;
        hole.char = null;
        return;
      }
    }
    s.combo = 0;
  };

  /** Draw a raised neon vault pad under each spawn slot. */
  const drawPlatform = (
    ctx: CanvasRenderingContext2D,
    hole: Hole,
    occupied: boolean,
    accent: string,
    t: number,
  ) => {
    const { x, y, r } = hole;
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.8 + x * 0.05));
    const active = occupied || hole.glow > 0;
    const glowBoost = hole.glow * 0.8;
    const rx = r * 1.12;
    const ry = r * 0.4;

    // floor shadow
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.ellipse(x + 3, y + ry * 0.35, rx * 1.05, ry * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // pedestal base (dark metal stack)
    const baseGrad = ctx.createLinearGradient(x - rx, y - ry * 0.4, x + rx, y + ry);
    baseGrad.addColorStop(0, "#1a0a2e");
    baseGrad.addColorStop(0.5, "#0c0618");
    baseGrad.addColorStop(1, "#16082a");
    ctx.beginPath();
    ctx.fillStyle = baseGrad;
    ctx.ellipse(x, y + 4, rx * 0.98, ry * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // raised lip / outer rim
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(accent, active ? 0.85 + glowBoost * 0.15 : 0.35 + pulse * 0.2);
    ctx.lineWidth = 3.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = active ? 18 + glowBoost * 16 : 8 + pulse * 6;
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // inner deck plate
    const deck = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.4, 2, x, y, rx);
    deck.addColorStop(0, hexToRgba(accent, active ? 0.35 + glowBoost * 0.25 : 0.12 + pulse * 0.08));
    deck.addColorStop(0.45, "rgba(18,8,36,0.95)");
    deck.addColorStop(1, hexToRgba(accent, active ? 0.22 : 0.08));
    ctx.beginPath();
    ctx.fillStyle = deck;
    ctx.ellipse(x, y - 2, rx * 0.82, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // tech ring segments (official pad look)
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 + t * 0.4;
      const a1 = a0 + (Math.PI * 2) / segs - 0.18;
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(
        accent,
        active ? 0.55 + 0.35 * Math.sin(t * 4 + i) : 0.18 + pulse * 0.12,
      );
      ctx.lineWidth = 2;
      ctx.ellipse(x, y - 2, rx * 0.68, ry * 0.58, 0, a0, a1);
      ctx.stroke();
    }

    // center hex plate
    ctx.beginPath();
    const hr = r * 0.28;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(a) * hr;
      const py = y - 3 + Math.sin(a) * hr * 0.45;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = hexToRgba(accent, active ? 0.28 + glowBoost * 0.3 : 0.1 + pulse * 0.08);
    ctx.strokeStyle = hexToRgba(accent, active ? 0.9 : 0.4);
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // crosshair / lock ticks when empty
    if (!occupied) {
      ctx.strokeStyle = hexToRgba("#3ecbff", 0.2 + pulse * 0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.15, y - 2);
      ctx.lineTo(x + r * 0.15, y - 2);
      ctx.moveTo(x, y - 2 - r * 0.1);
      ctx.lineTo(x, y - 2 + r * 0.1);
      ctx.stroke();
    }

    // ground glow bloom when occupied
    if (active) {
      const bloom = ctx.createRadialGradient(x, y, 2, x, y, rx * 1.4);
      bloom.addColorStop(0, hexToRgba(accent, 0.35 + glowBoost * 0.35));
      bloom.addColorStop(1, "transparent");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, rx * 1.15, ry * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useGameLoop(canvasRef, {
    onResize: (api) => {
      if (statusRef.current !== "playing") layoutHoles(api.width, api.height);
    },
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      s.shake = Math.max(0, s.shake - dt * 6);

      // idle ambient on ready pads
      if (statusRef.current === "ready") {
        if (s.holes.length === 0) layoutHoles(api.width, api.height);
        for (const h of s.holes) h.glow = Math.max(0, h.glow - dt * 1.5);
        return;
      }

      if (statusRef.current !== "playing") return;

      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        endGame();
        return;
      }

      for (const h of s.holes) h.glow = Math.max(0, h.glow - dt * 2.2);

      s.spawnCd -= dt;
      if (s.spawnCd <= 0) {
        const free = s.holes.filter((h) => !h.char);
        if (free.length) {
          const char = pickReadyCharacter();
          if (char) {
            const hole = free[Math.floor(Math.random() * free.length)]!;
            hole.char = char;
            hole.phase = 0.01;
            hole.life = 0;
            hole.maxLife =
              char.rarity === "common"
                ? 1.15
                : char.rarity === "mythic" || char.rarity === "void"
                  ? 0.72
                  : 0.95;
            hole.hit = false;
            hole.glow = 0.6;
          }
        }
        // If nothing ready yet, retry sooner so first spawn isn't delayed long
        const pace =
          s.readyIds.size === 0
            ? 0.15
            : Math.max(0.28, 0.85 - (DURATION - s.timeLeft) * 0.012);
        s.spawnCd = pace;
      }

      for (const hole of s.holes) {
        if (!hole.char) continue;
        // Hold spawn animation until image is in cache (should already be)
        if (!s.idleImgs.has(hole.char.id)) {
          hole.life = 0;
          hole.phase = 0;
          continue;
        }
        hole.life += dt;
        const t = hole.life / hole.maxLife;
        if (t < 0.16) hole.phase = t / 0.16;
        else if (t > 0.82) hole.phase = (1 - t) / 0.18;
        else hole.phase = 1;
        if (t >= 1) {
          hole.char = null;
          hole.phase = 0;
          s.combo = 0;
        }
      }

      for (const f of s.flashes) f.t -= dt;
      s.flashes = s.flashes.filter((f) => f.t > 0);

      for (const sp of s.sparks) {
        sp.life -= dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 260 * dt;
      }
      s.sparks = s.sparks.filter((sp) => sp.life > 0);
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      if (s.holes.length === 0) layoutHoles(width, height);

      ctx.save();
      if (s.shake > 0) {
        const mag = s.shake * 5;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // neon void bg
      const bg = ctx.createLinearGradient(0, 0, width * 0.15, height);
      bg.addColorStop(0, "#22063a");
      bg.addColorStop(0.45, "#0e0520");
      bg.addColorStop(1, "#05020e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // aurora
      const w1 = ctx.createRadialGradient(width * 0.2, height * 0.15, 8, width * 0.2, height * 0.15, width * 0.5);
      w1.addColorStop(0, "rgba(255,43,214,0.14)");
      w1.addColorStop(1, "transparent");
      ctx.fillStyle = w1;
      ctx.fillRect(0, 0, width, height);
      const w2 = ctx.createRadialGradient(width * 0.85, height * 0.2, 8, width * 0.85, height * 0.2, width * 0.45);
      w2.addColorStop(0, "rgba(62,203,255,0.12)");
      w2.addColorStop(1, "transparent");
      ctx.fillStyle = w2;
      ctx.fillRect(0, 0, width, height);

      // subtle floor grid
      ctx.strokeStyle = "rgba(62,203,255,0.06)";
      ctx.lineWidth = 1;
      for (let gy = 60; gy < height; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy + ((s.time * 12) % 28));
        ctx.lineTo(width, gy + ((s.time * 12) % 28));
        ctx.stroke();
      }

      // side rails
      const railPulse = 0.4 + 0.25 * Math.sin(s.time * 3);
      for (const side of [0, 1] as const) {
        const x = side === 0 ? 0 : width - 3;
        const rg = ctx.createLinearGradient(0, 0, 0, height);
        rg.addColorStop(0, hexToRgba("#ff2bd6", railPulse));
        rg.addColorStop(0.5, hexToRgba("#3ecbff", railPulse + 0.15));
        rg.addColorStop(1, hexToRgba("#f5e642", railPulse));
        ctx.fillStyle = rg;
        ctx.shadowColor = side === 0 ? "#ff2bd6" : "#3ecbff";
        ctx.shadowBlur = 12;
        ctx.fillRect(x, 0, 3, height);
        ctx.shadowBlur = 0;
      }

      // timer bar
      const barW = width - 32;
      const pct = statusRef.current === "playing" ? s.timeLeft / DURATION : 1;
      ctx.fillStyle = "rgba(62,203,255,0.12)";
      roundRect(ctx, 16, 12, barW, 12, 6);
      ctx.fill();
      const barGrad = ctx.createLinearGradient(16, 0, 16 + barW, 0);
      if (pct > 0.25) {
        barGrad.addColorStop(0, "#3ecbff");
        barGrad.addColorStop(1, "#7c5cff");
      } else {
        barGrad.addColorStop(0, "#ff4d6d");
        barGrad.addColorStop(1, "#ff2bd6");
      }
      ctx.fillStyle = barGrad;
      ctx.shadowColor = pct > 0.25 ? "#3ecbff" : "#ff4d6d";
      ctx.shadowBlur = 10;
      roundRect(ctx, 16, 12, Math.max(4, barW * pct), 12, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // platforms first (behind agents)
      for (const hole of s.holes) {
        const accent = hole.char
          ? rarityNeon(hole.char.rarity)
          : hole.glow > 0
            ? "#f5e642"
            : "#3ecbff";
        drawPlatform(ctx, hole, !!hole.char && hole.phase > 0.05, accent, s.time);
      }

      // agents on top of platforms
      for (const hole of s.holes) {
        if (!hole.char || hole.phase <= 0) continue;
        const idle = s.idleImgs.get(hole.char.id);
        if (!idle) continue; // never draw circle placeholder

        const { cx, cy, size, deckY } = agentCenter(hole);
        const pop = hole.phase;
        const neon = rarityNeon(hole.char.rarity);

        // soft contact shadow on deck
        ctx.beginPath();
        ctx.fillStyle = hexToRgba(neon, 0.25 * pop);
        ctx.ellipse(hole.x, deckY + 2, size * 0.28 * pop, size * 0.08 * pop, 0, 0, Math.PI * 2);
        ctx.fill();

        // agent glow
        ctx.save();
        ctx.shadowColor = neon;
        ctx.shadowBlur = 14 + pop * 10;
        ctx.globalAlpha = 0.7 + pop * 0.3;
        drawSprite(ctx, idle, cx - size / 2, cy - size / 2, size, size);
        ctx.restore();

        // rarity halo ring around feet / mid
        ctx.strokeStyle = hexToRgba(neon, 0.4 + pop * 0.45);
        ctx.lineWidth = 2;
        ctx.shadowColor = neon;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(hole.x, deckY + 1, hole.r * 0.55 * pop, hole.r * 0.18 * pop, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // name tag chip
        if (pop > 0.7) {
          const label = hole.char.name.split(" ")[0]!;
          ctx.font = "700 10px Rajdhani, sans-serif";
          ctx.textAlign = "center";
          const tw = ctx.measureText(label).width;
          const tx = cx;
          const ty = cy - size * 0.48;
          ctx.fillStyle = "rgba(8,4,18,0.75)";
          roundRect(ctx, tx - tw / 2 - 6, ty - 12, tw + 12, 16, 6);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(neon, 0.7);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = neon;
          ctx.shadowColor = neon;
          ctx.shadowBlur = 6;
          ctx.fillText(label, tx, ty);
          ctx.shadowBlur = 0;
        }
      }

      // sparks
      for (const sp of s.sparks) {
        const a = Math.max(0, sp.life / sp.maxLife);
        ctx.fillStyle = hexToRgba(sp.color, a);
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // floaters
      for (const f of s.flashes) {
        const a = Math.max(0, f.t / 0.65);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font = "800 18px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 14;
        ctx.fillText(`+${f.pts}`, f.x, f.y - (0.65 - f.t) * 36);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      if (statusRef.current === "playing" && s.combo >= 3) {
        ctx.fillStyle = "#f5e642";
        ctx.font = "800 13px Orbitron, sans-serif";
        ctx.textAlign = "right";
        ctx.shadowColor = "#f5e642";
        ctx.shadowBlur = 12;
        ctx.fillText(`COMBO x${1 + Math.floor(s.combo / 3) * 0.25}`, width - 16, height - 14);
        ctx.shadowBlur = 0;
      }

      // ready: demo glow on a couple pads
      if (statusRef.current === "ready") {
        for (let i = 0; i < s.holes.length; i++) {
          if (i % 3 === Math.floor(s.time) % 3) s.holes[i]!.glow = 0.35 + 0.2 * Math.sin(s.time * 3);
        }
      }

      ctx.restore();
    },
  });

  return (
    <GameCanvasShell
      meta={meta}
      score={score}
      highScore={high}
      status={status}
      onRestart={() => {
        setStatus("ready");
        setScore(0);
      }}
      onStart={start}
      pilotLocationHint="Your character sits in the HUD. Critters pop on the pads — tap them."
      hint="45s — tap critters. Rares score more."
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          hitAt(e.clientX, e.clientY);
        }}
      />
    </GameCanvasShell>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
