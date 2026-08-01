import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { CHARACTERS, drawSprite, loadImage, type Character } from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";

type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  char: Character;
  alive: boolean;
  hitFlash: number;
  pulse: number;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  trail: { x: number; y: number; a: number }[];
  hue: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: "spark" | "ring" | "shard";
};

type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};

type GridDot = { x: number; y: number; phase: number; layer: number };

const meta = getGame("breakout")!;

const NEON = ["#ff2bd6", "#3ecbff", "#f5e642", "#7c5cff", "#3dff9a", "#ff6b2b", "#ff4d6d"];

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

function hexToRgba(hex: string | undefined, a: number): string {
  if (!hex || typeof hex !== "string") return `rgba(245,230,66,${a})`;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(245,230,66,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const [lives, setLives] = useState(3);
  const [pauseKind, setPauseKind] = useState<"manual" | "level">("manual");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("breakout"));
  const statusRef = useRef(status);
  statusRef.current = status;
  const pauseKindRef = useRef(pauseKind);
  pauseKindRef.current = pauseKind;

  const state = useRef({
    paddleX: 0,
    paddleW: 90,
    paddleH: 15,
    balls: [] as Ball[],
    bricks: [] as Brick[],
    particles: [] as Particle[],
    floaters: [] as Floater[],
    grid: [] as GridDot[],
    pointerX: 0,
    pointerActive: false,
    keys: { left: false, right: false },
    score: 0,
    combo: 0,
    comboTimer: 0,
    images: new Map<string, HTMLImageElement>(),
    w: 360,
    h: 520,
    time: 0,
    shake: 0,
    flash: 0,
    level: 1,
    lives: 3,
    paddleGlow: 0,
    seeded: false,
    pilot: getSelectedAgent(),
    pilotImg: null as HTMLImageElement | null,
  });

  const buildGrid = (w: number, h: number) => {
    const dots: GridDot[] = [];
    for (let i = 0; i < 56; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        phase: Math.random() * Math.PI * 2,
        layer: i % 3,
      });
    }
    return dots;
  };

  const burst = (x: number, y: number, color: string, power = 1) => {
    const s = state.current;
    const n = Math.floor(12 + power * 12);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 240 * power;
      s.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        life: 0.35 + Math.random() * 0.5,
        maxLife: 0.85,
        color,
        size: 1.6 + Math.random() * 3.8 * power,
        kind: Math.random() > 0.82 ? "ring" : Math.random() > 0.5 ? "shard" : "spark",
      });
    }
    s.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      maxLife: 0.3,
      color,
      size: 20 * power,
      kind: "ring",
    });
  };

  const addFloater = (x: number, y: number, text: string, color: string) => {
    state.current.floaters.push({ x, y, text, life: 0.95, color });
  };

  const layoutBricks = (w: number, level: number) => {
    const s = state.current;
    const cols = w < 400 ? 5 : 7;
    const rows = Math.min(6, 3 + Math.floor(level / 2));
    const gap = 5;
    const padX = 12;
    const top = 78;
    const bw = (w - padX * 2 - gap * (cols - 1)) / cols;
    const bh = 34;
    const bricks: Brick[] = [];
    const start = (level * 3) % CHARACTERS.length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = CHARACTERS[(start + r * cols + c) % CHARACTERS.length]!;
        let hp =
          char.rarity === "common"
            ? 1
            : char.rarity === "uncommon"
              ? 2
              : char.rarity === "rare"
                ? 2
                : 3;
        if (level > 2 && char.rarity === "common" && (r + c) % 3 === 0) hp = 2;
        bricks.push({
          x: padX + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          hp,
          maxHp: hp,
          char,
          alive: true,
          hitFlash: 0,
          pulse: Math.random() * Math.PI * 2,
        });
        if (!s.images.has(char.id)) {
          loadImage(char.idle).then((img) => s.images.set(char.id, img));
        }
      }
    }
    return bricks;
  };


  const spawnBall = (w: number, h: number, level: number) => {
    const s = state.current;
    const speedBoost = 1 + (level - 1) * 0.06;
    s.balls = [
      {
        x: s.paddleX + s.paddleW / 2,
        y: h - 110,
        vx: (Math.random() > 0.5 ? 1 : -1) * 195 * speedBoost,
        vy: -290 * speedBoost,
        r: 8,
        trail: [],
        hue: Math.random() * 360,
      },
    ];
  };

  const prepareLevel = (w: number, h: number, keepScore: number, level: number, withBall: boolean) => {
    const s = state.current;
    s.w = w;
    s.h = h;
    s.level = level;
    s.paddleW = Math.max(80, Math.min(130, w * 0.28));
    s.paddleX = w / 2 - s.paddleW / 2;
    s.score = keepScore;
    setScore(keepScore);
    s.combo = 0;
    s.comboTimer = 0;
    s.particles = [];
    s.floaters = [];
    s.shake = 0;
    s.flash = 0;
    s.grid = buildGrid(w, h);
    s.bricks = layoutBricks(w, level);
    s.seeded = true;
    s.pilot = getSelectedAgent();
    loadImage(s.pilot.idle).then((img) => {
      s.pilotImg = img;
    });
    if (withBall) spawnBall(w, h, level);
    else s.balls = [];
  };

  const resetWorld = useCallback((w: number, h: number, keepScore = 0, level = 1, livesCount = 3) => {
    const s = state.current;
    s.time = 0;
    s.lives = livesCount;
    setLives(livesCount);
    prepareLevel(w, h, keepScore, level, true);
  }, []);

  const pauseGame = (kind: "manual" | "level" = "manual") => {
    if (statusRef.current !== "playing") return;
    setPauseKind(kind);
    setStatus("paused");
  };

  const resumeGame = () => {
    if (statusRef.current !== "paused") return;
    const s = state.current;
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || s.w || 360;
    const h = canvas?.clientHeight || s.h || 520;
    // Between-level rest: arm the next board with a fresh ball only when they continue
    if (pauseKindRef.current === "level") {
      if (s.balls.length === 0) spawnBall(w, h, s.level);
      s.flash = 0.45;
      addFloater(w / 2, h * 0.38, `LEVEL ${s.level}`, "#f5e642");
    }
    setStatus("playing");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        state.current.keys.left = down;
        if (down) state.current.pointerActive = false;
        e.preventDefault();
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        state.current.keys.right = down;
        if (down) state.current.pointerActive = false;
        e.preventDefault();
      }
      if (!down) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        if (statusRef.current === "playing") pauseGame("manual");
        else if (statusRef.current === "paused") resumeGame();
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (statusRef.current === "ready" || statusRef.current === "over") {
          e.preventDefault();
          start();
        } else if (statusRef.current === "paused") {
          e.preventDefault();
          resumeGame();
        }
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  });

  const start = () => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 360;
    const h = canvas?.clientHeight || 520;
    resetWorld(w, h, 0, 1, 3);
    state.current.pointerActive = false;
    state.current.keys.left = false;
    state.current.keys.right = false;
    setPauseKind("manual");
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("breakout", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  useGameLoop(canvasRef, {
    onResize: (api) => {
      const s = state.current;
      s.w = api.width;
      s.h = api.height;
      if (statusRef.current === "ready") {
        s.paddleX = api.width / 2 - s.paddleW / 2;
        if (!s.seeded || s.bricks.length === 0) {
          s.grid = buildGrid(api.width, api.height);
          s.bricks = layoutBricks(api.width, 1);
          s.seeded = true;
        }
      }
    },
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      s.shake = Math.max(0, s.shake - dt * 8);
      s.flash = Math.max(0, s.flash - dt * 3.2);
      s.paddleGlow = Math.max(0, s.paddleGlow - dt * 2.5);
      s.comboTimer = Math.max(0, s.comboTimer - dt);
      if (s.comboTimer <= 0) s.combo = 0;

      if (!s.seeded && api.width > 0) {
        s.grid = buildGrid(api.width, api.height);
        s.bricks = layoutBricks(api.width, 1);
        s.paddleW = Math.max(80, Math.min(130, api.width * 0.28));
        s.paddleX = api.width / 2 - s.paddleW / 2;
        s.seeded = true;
      }

      for (const b of s.bricks) {
        if (b.alive) {
          b.pulse += dt * 2.6;
          b.hitFlash = Math.max(0, b.hitFlash - dt * 5);
        }
      }

      for (const p of s.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 280 * dt;
        p.vx *= 0.98;
      }
      s.particles = s.particles.filter((p) => p.life > 0);

      for (const f of s.floaters) {
        f.life -= dt;
        f.y -= 44 * dt;
      }
      s.floaters = s.floaters.filter((f) => f.life > 0);

      for (const g of s.grid) {
        g.y += (8 + g.layer * 10) * dt;
        if (g.y > api.height + 4) {
          g.y = -4;
          g.x = Math.random() * api.width;
        }
      }

      if (statusRef.current === "ready" && Math.random() < dt * 2.5 && s.bricks.length) {
        const b = s.bricks[Math.floor(Math.random() * s.bricks.length)]!;
        burst(b.x + b.w * Math.random(), b.y + b.h * 0.5, rarityNeon(b.char.rarity), 0.25);
      }

      if (statusRef.current !== "playing") return;

      const speed = 560;
      const usingKeys = s.keys.left || s.keys.right;
      if (usingKeys) {
        if (s.keys.left) s.paddleX -= speed * dt;
        if (s.keys.right) s.paddleX += speed * dt;
      } else if (s.pointerActive) {
        s.paddleX = s.pointerX - s.paddleW / 2;
      }
      s.paddleX = Math.max(6, Math.min(api.width - s.paddleW - 6, s.paddleX));

      for (const ball of s.balls) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.hue = (ball.hue + dt * 160) % 360;
        ball.trail.unshift({ x: ball.x, y: ball.y, a: 1 });
        if (ball.trail.length > 16) ball.trail.length = 16;
        for (let i = 0; i < ball.trail.length; i++) ball.trail[i]!.a = 1 - i / ball.trail.length;

        if (ball.x < ball.r) {
          ball.x = ball.r;
          ball.vx *= -1;
          burst(ball.x, ball.y, "#3ecbff", 0.5);
        }
        if (ball.x > api.width - ball.r) {
          ball.x = api.width - ball.r;
          ball.vx *= -1;
          burst(ball.x, ball.y, "#ff2bd6", 0.5);
        }
        if (ball.y < ball.r + 4) {
          ball.y = ball.r + 4;
          ball.vy *= -1;
          burst(ball.x, ball.y, "#f5e642", 0.45);
        }

        const py = api.height - 36;
        if (
          ball.vy > 0 &&
          ball.y + ball.r >= py &&
          ball.y - ball.r <= py + s.paddleH + 4 &&
          ball.x >= s.paddleX - 6 &&
          ball.x <= s.paddleX + s.paddleW + 6
        ) {
          const hit = (ball.x - (s.paddleX + s.paddleW / 2)) / (s.paddleW / 2);
          ball.vx = hit * 330;
          ball.vy = -Math.abs(ball.vy) * 1.03;
          ball.y = py - ball.r;
          const mag = Math.hypot(ball.vx, ball.vy);
          const target = Math.min(470, Math.max(305, mag));
          ball.vx *= target / (mag || 1);
          ball.vy *= target / (mag || 1);
          s.paddleGlow = 1;
          s.combo = 0;
          burst(ball.x, py, "#f5e642", 0.6);
        }

        for (const brick of s.bricks) {
          if (!brick.alive) continue;
          if (
            ball.x + ball.r > brick.x &&
            ball.x - ball.r < brick.x + brick.w &&
            ball.y + ball.r > brick.y &&
            ball.y - ball.r < brick.y + brick.h
          ) {
            const color = rarityNeon(brick.char.rarity);
            brick.hp -= 1;
            brick.hitFlash = 1;
            s.combo += 1;
            s.comboTimer = 1.7;
            const mult = 1 + Math.min(5, Math.floor(s.combo / 3)) * 0.25;
            const pts = Math.round(brick.char.points * mult * (brick.hp <= 0 ? 1 : 0.35));

            if (brick.hp <= 0) {
              brick.alive = false;
              const gain = Math.max(pts, brick.char.points);
              s.score += gain;
              setScore(s.score);
              burst(brick.x + brick.w / 2, brick.y + brick.h / 2, color, 1.2);
              addFloater(brick.x + brick.w / 2, brick.y, `+${gain}`, color);
              if (s.combo >= 4) {
                addFloater(brick.x + brick.w / 2, brick.y - 16, `x${s.combo} COMBO`, "#f5e642");
              }
              s.shake = Math.min(1.25, s.shake + 0.4);
              s.flash = Math.min(0.6, s.flash + 0.25);
            } else {
              s.score += pts;
              setScore(s.score);
              burst(ball.x, ball.y, color, 0.6);
              addFloater(brick.x + brick.w / 2, brick.y, `+${pts}`, color);
              s.shake = Math.min(0.85, s.shake + 0.18);
            }

            const overlapL = ball.x + ball.r - brick.x;
            const overlapR = brick.x + brick.w - (ball.x - ball.r);
            const overlapT = ball.y + ball.r - brick.y;
            const overlapB = brick.y + brick.h - (ball.y - ball.r);
            const minO = Math.min(overlapL, overlapR, overlapT, overlapB);
            if (minO === overlapL || minO === overlapR) ball.vx *= -1;
            else ball.vy *= -1;
            break;
          }
        }
      }

      s.balls = s.balls.filter((b) => b.y < api.height + 40);
      if (s.balls.length === 0) {
        s.lives = Math.max(0, s.lives - 1);
        setLives(s.lives);
        s.combo = 0;
        s.shake = Math.min(1.2, s.shake + 0.5);
        s.flash = 0.55;
        if (s.lives <= 0) {
          endGame();
          return;
        }
        // still alive — respawn ball from paddle
        spawnBall(api.width, api.height, s.level);
        addFloater(api.width / 2, api.height * 0.55, `${s.lives} LEFT`, "#ff4d6d");
        burst(s.paddleX + s.paddleW / 2, api.height - 40, "#ff4d6d", 0.9);
        return;
      }
      if (s.bricks.length > 0 && s.bricks.every((b) => !b.alive)) {
        const keep = s.score + 150 * s.level;
        const nextLevel = s.level + 1;
        // Build next board but HOLD for rest — player continues when ready
        prepareLevel(api.width, api.height, keep, nextLevel, false);
        setScore(keep);
        s.flash = 0.75;
        burst(api.width / 2, api.height * 0.36, "#3ecbff", 1.5);
        burst(api.width / 2, api.height * 0.36, "#ff2bd6", 1.1);
        setPauseKind("level");
        setStatus("paused");
      }
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      ctx.save();
      if (s.shake > 0) {
        const mag = s.shake * 7;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      const bg = ctx.createLinearGradient(0, 0, width * 0.2, height);
      bg.addColorStop(0, "#22063a");
      bg.addColorStop(0.4, "#0e0520");
      bg.addColorStop(1, "#05020e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const gridY = height * 0.52;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, gridY, width, height - gridY);
      ctx.clip();
      const vanishX = width / 2;
      const vanishY = gridY - 36;
      const scroll = (s.time * 48) % 34;
      for (let i = -2; i < 20; i++) {
        const y = gridY + i * 34 + scroll;
        const a = 0.06 + (i / 20) * 0.1;
        ctx.strokeStyle = `rgba(62,203,255,${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(vanishX, vanishY);
        ctx.lineTo(vanishX + i * (width * 0.12), height + 30);
        ctx.strokeStyle =
          i === 0 ? "rgba(245,230,66,0.18)" : i % 2 === 0 ? "rgba(255,43,214,0.12)" : "rgba(124,92,255,0.1)";
        ctx.stroke();
      }
      ctx.restore();

      const wash1 = ctx.createRadialGradient(
        width * 0.2,
        height * 0.15,
        10,
        width * 0.2,
        height * 0.15,
        width * 0.55,
      );
      wash1.addColorStop(0, "rgba(255,43,214,0.14)");
      wash1.addColorStop(1, "transparent");
      ctx.fillStyle = wash1;
      ctx.fillRect(0, 0, width, height);
      const wash2 = ctx.createRadialGradient(
        width * 0.8,
        height * 0.1,
        10,
        width * 0.8,
        height * 0.1,
        width * 0.5,
      );
      wash2.addColorStop(0, "rgba(62,203,255,0.12)");
      wash2.addColorStop(1, "transparent");
      ctx.fillStyle = wash2;
      ctx.fillRect(0, 0, width, height);

      for (const g of s.grid) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.time * 2.4 + g.phase));
        const col = NEON[Math.abs(g.layer + Math.floor(s.time)) % NEON.length]!;
        ctx.fillStyle = hexToRgba(col, 0.18 + tw * 0.4);
        ctx.beginPath();
        ctx.arc(g.x, g.y, 1.1 + g.layer * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      const railPulse = 0.4 + 0.3 * Math.sin(s.time * 3.2);
      for (const side of [0, 1] as const) {
        const x = side === 0 ? 0 : width - 4;
        const rg = ctx.createLinearGradient(0, 0, 0, height);
        rg.addColorStop(0, hexToRgba("#ff2bd6", railPulse));
        rg.addColorStop(0.35, hexToRgba("#7c5cff", railPulse + 0.1));
        rg.addColorStop(0.7, hexToRgba("#3ecbff", railPulse + 0.15));
        rg.addColorStop(1, hexToRgba("#f5e642", railPulse));
        ctx.fillStyle = rg;
        ctx.shadowColor = side === 0 ? "#ff2bd6" : "#3ecbff";
        ctx.shadowBlur = 16;
        ctx.fillRect(x, 0, 4, height);
        ctx.shadowBlur = 0;
      }

      for (const brick of s.bricks) {
        if (!brick.alive) continue;
        const neon = rarityNeon(brick.char.rarity);
        const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(brick.pulse));
        const flash = brick.hitFlash;

        ctx.shadowColor = neon;
        ctx.shadowBlur = 12 + pulse * 14 + flash * 24;

        const body = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.w, brick.y + brick.h);
        body.addColorStop(0, hexToRgba(neon, 0.65 + flash * 0.3));
        body.addColorStop(0.4, hexToRgba("#1a0a30", 0.94));
        body.addColorStop(1, hexToRgba(neon, 0.35 + pulse * 0.25));
        ctx.fillStyle = body;
        roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 8);
        ctx.fill();

        ctx.strokeStyle = flash > 0 ? "#ffffff" : neon;
        ctx.lineWidth = 2 + flash * 1.8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const shine = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h * 0.5);
        shine.addColorStop(0, "rgba(255,255,255,0.22)");
        shine.addColorStop(1, "transparent");
        ctx.fillStyle = shine;
        roundRect(ctx, brick.x + 2, brick.y + 2, brick.w - 4, brick.h * 0.45, 6);
        ctx.fill();

        if (brick.maxHp > 1) {
          for (let i = 0; i < brick.maxHp; i++) {
            ctx.fillStyle = i < brick.hp ? neon : "rgba(255,255,255,0.12)";
            ctx.shadowColor = i < brick.hp ? neon : "transparent";
            ctx.shadowBlur = i < brick.hp ? 6 : 0;
            ctx.beginPath();
            ctx.arc(brick.x + brick.w - 10 - i * 9, brick.y + 9, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        const img = s.images.get(brick.char.id);
        if (img) {
          const size = Math.min(brick.h - 8, brick.w * 0.4);
          ctx.drawImage(img, brick.x + 6, brick.y + (brick.h - size) / 2, size, size);
        }

        ctx.fillStyle = "#f8f6ff";
        ctx.font = "700 11px Rajdhani, sans-serif";
        ctx.textAlign = "left";
        ctx.shadowColor = neon;
        ctx.shadowBlur = 8;
        ctx.fillText(brick.char.name.split(" ")[0]!, brick.x + brick.h * 0.78, brick.y + brick.h / 2 + 4);
        ctx.shadowBlur = 0;
      }

      for (const p of s.particles) {
        const t = Math.max(0, p.life / p.maxLife);
        if (p.kind === "ring") {
          ctx.strokeStyle = hexToRgba(p.color, t * 0.95);
          ctx.lineWidth = 2.2;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.35 - t), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = hexToRgba(p.color, t);
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          if (p.kind === "shard") {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.vx * 0.02 + s.time * 4);
            ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2.2, p.size * 0.7);
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
      }

      for (const f of s.floaters) {
        const a = Math.min(1, f.life * 2.2);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font =
          f.text.includes("COMBO") || f.text.includes("LEVEL")
            ? "800 17px Orbitron, sans-serif"
            : "700 14px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 14;
        ctx.fillText(f.text, f.x, f.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      const py = height - 36;
      const padX =
        statusRef.current === "ready"
          ? width / 2 - s.paddleW / 2 + Math.sin(s.time * 1.5) * width * 0.18
          : s.paddleX;
      const pg = ctx.createLinearGradient(padX, py, padX + s.paddleW, py);
      pg.addColorStop(0, "#ff2bd6");
      pg.addColorStop(0.3, "#3ecbff");
      pg.addColorStop(0.55, "#f5e642");
      pg.addColorStop(0.8, "#7c5cff");
      pg.addColorStop(1, "#3dff9a");
      ctx.shadowColor = s.paddleGlow > 0 ? "#f5e642" : "#3ecbff";
      ctx.shadowBlur = 16 + s.paddleGlow * 24;
      ctx.fillStyle = pg;
      roundRect(ctx, padX, py, s.paddleW, s.paddleH, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      roundRect(ctx, padX + 10, py + 3, s.paddleW - 20, 4, 3);
      ctx.fill();

      // Pilot location: rides the paddle
      if (s.pilotImg) {
        const ps = Math.min(42, s.paddleW * 0.45);
        const px0 = padX + s.paddleW / 2 - ps / 2;
        const py0 = py - ps + 8;
        ctx.save();
        ctx.shadowColor = s.pilot.accent;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.fillStyle = "rgba(8,4,16,0.5)";
        ctx.ellipse(padX + s.paddleW / 2, py + 2, ps * 0.4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        drawSprite(ctx, s.pilotImg, px0, py0, ps, ps);
        ctx.restore();
      }

      const ug = ctx.createLinearGradient(padX, py + 18, padX + s.paddleW, py + 18);
      ug.addColorStop(0, "rgba(255,43,214,0)");
      ug.addColorStop(0.5, hexToRgba("#3ecbff", 0.4 + s.paddleGlow * 0.45));
      ug.addColorStop(1, "rgba(245,230,66,0)");
      ctx.fillStyle = ug;
      ctx.fillRect(padX - 12, py + s.paddleH + 2, s.paddleW + 24, 12);

      for (const ball of s.balls) {
        for (let i = ball.trail.length - 1; i >= 0; i--) {
          const t = ball.trail[i]!;
          const hue = (ball.hue + i * 20) % 360;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${hue}, 100%, 62%, ${t.a * 0.55})`;
          ctx.shadowColor = `hsl(${hue}, 100%, 55%)`;
          ctx.shadowBlur = 8;
          ctx.arc(t.x, t.y, ball.r * (0.3 + t.a * 0.7), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        const core = ctx.createRadialGradient(
          ball.x - 2,
          ball.y - 2,
          1,
          ball.x,
          ball.y,
          ball.r * 2.4,
        );
        core.addColorStop(0, "#ffffff");
        core.addColorStop(0.3, `hsl(${ball.hue}, 100%, 68%)`);
        core.addColorStop(1, `hsla(${(ball.hue + 90) % 360}, 100%, 50%, 0)`);
        ctx.fillStyle = core;
        ctx.shadowColor = `hsl(${ball.hue}, 100%, 55%)`;
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (statusRef.current === "ready") {
        const bx = width / 2 + Math.sin(s.time * 2.2) * width * 0.22;
        const by = height * 0.62 + Math.cos(s.time * 1.7) * 28;
        ctx.shadowColor = "#f5e642";
        ctx.shadowBlur = 22;
        const idle = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 16);
        idle.addColorStop(0, "#fff");
        idle.addColorStop(0.4, "#f5e642");
        idle.addColorStop(1, "rgba(255,43,214,0)");
        ctx.fillStyle = idle;
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (statusRef.current === "playing" || statusRef.current === "paused") {
        // top HUD strip (above brick field)
        ctx.fillStyle = "rgba(5,2,14,0.55)";
        ctx.fillRect(0, 0, width, 44);
        ctx.strokeStyle = "rgba(62,203,255,0.25)";
        ctx.beginPath();
        ctx.moveTo(0, 44);
        ctx.lineTo(width, 44);
        ctx.stroke();

        ctx.fillStyle = "rgba(62,203,255,0.95)";
        ctx.font = "700 12px Orbitron, sans-serif";
        ctx.textAlign = "left";
        ctx.shadowColor = "#3ecbff";
        ctx.shadowBlur = 8;
        ctx.fillText(`LVL ${s.level}`, 14, 28);
        ctx.shadowBlur = 0;

        // lives — top center, large pips so never under bricks
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,43,214,0.9)";
        ctx.font = "700 10px Orbitron, sans-serif";
        ctx.shadowColor = "#ff2bd6";
        ctx.shadowBlur = 8;
        ctx.fillText("LIVES", width / 2, 14);
        ctx.shadowBlur = 0;
        const pipY = 30;
        const startX = width / 2 - 28;
        for (let i = 0; i < 3; i++) {
          const on = i < s.lives;
          const cx = startX + i * 28;
          // outer glow ring
          ctx.beginPath();
          ctx.strokeStyle = on ? "rgba(255,43,214,0.85)" : "rgba(255,255,255,0.18)";
          ctx.lineWidth = 2;
          ctx.shadowColor = on ? "#ff2bd6" : "transparent";
          ctx.shadowBlur = on ? 14 : 0;
          ctx.arc(cx, pipY, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.fillStyle = on ? "#ff2bd6" : "rgba(255,255,255,0.1)";
          ctx.arc(cx, pipY, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (s.combo >= 2 && statusRef.current === "playing") {
          ctx.fillStyle = hexToRgba("#f5e642", 0.95);
          ctx.font = "800 12px Orbitron, sans-serif";
          ctx.textAlign = "right";
          ctx.shadowColor = "#f5e642";
          ctx.shadowBlur = 12;
          ctx.fillText(`COMBO x${s.combo}`, width - 14, 28);
          ctx.shadowBlur = 0;
        }
      }

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.2})`;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();
    },
  });

  const onPointer = (clientX: number, active = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    state.current.pointerX = clientX - rect.left;
    state.current.pointerActive = active;
  };

  return (
    <GameCanvasShell
      meta={meta}
      score={score}
      highScore={high}
      status={status}
      onRestart={() => {
        setStatus("ready");
        setScore(0);
        setLives(3);
        state.current.seeded = false;
        state.current.lives = 3;
      }}
      onStart={status === "paused" ? resumeGame : start}
      onPause={() => pauseGame("manual")}
      onResume={resumeGame}
      pauseTitle={pauseKind === "level" ? `Level ${state.current.level} ready` : "Paused"}
      pauseMessage={
        pauseKind === "level"
          ? `Board clear! +bonus scored. You have ${lives} life${lives === 1 ? "" : "ves"} left — continue when you're ready.`
          : "Take a breath. Your lives and score are held."
      }
      resumeLabel={pauseKind === "level" ? "Next level" : "Resume"}
      hidePlayPilot
      pilotLocationHint="Your pilot rides the paddle at the bottom — protect them and smash the wall."
      hint="← → / A D · 3 lives · P/Esc pause · clear board to rest"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={(e) => {
          // Only steer with pointer while a button/finger is down (or after press)
          if (e.buttons > 0 || state.current.pointerActive) onPointer(e.clientX, true);
        }}
        onPointerDown={(e) => {
          onPointer(e.clientX, true);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={() => {
          state.current.pointerActive = false;
        }}
        onPointerCancel={() => {
          state.current.pointerActive = false;
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
