import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { drawSprite, loadImage } from "@/lib/characters";
import { drawNeonVoid } from "@/games/neonFx";
import { getHighScore, setHighScore } from "@/lib/scores";

type Pipe = { x: number; gapY: number; gapH: number; passed: boolean };
type Star = {
  x: number;
  y: number;
  r: number;
  layer: number;
  phase: number;
  twinkle: number;
  driftY: number;
};

const meta = getGame("flappy")!;
const GRAVITY = 980;
const FLAP = -320;
const PIPE_SPEED = 160;
const PIPE_EVERY = 1.55;
const LAYER_SPEED = [18, 42, 78];

function seedStar(layer: number, w: number, h: number, x?: number): Star {
  return {
    x: x ?? Math.random() * w,
    y: Math.random() * h,
    r: 0.35 + Math.random() * (layer === 2 ? 1.8 : layer === 1 ? 1.3 : 0.9),
    layer,
    phase: Math.random() * Math.PI * 2,
    twinkle: 0.35 + Math.random() * 1.4,
    driftY: (Math.random() - 0.5) * (4 + layer * 3),
  };
}

function buildStars(w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 55; i++) stars.push(seedStar(0, w, h));
  for (let i = 0; i < 40; i++) stars.push(seedStar(1, w, h));
  for (let i = 0; i < 22; i++) stars.push(seedStar(2, w, h));
  return stars;
}

export function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("flappy"));
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    y: 200,
    vy: 0,
    pipes: [] as Pipe[],
    spawnTimer: 0,
    score: 0,
    char: getSelectedAgent(),
    idleImg: null as HTMLImageElement | null,
    dead: false,
    stars: [] as Star[],
    time: 0,
    nebulaPhase: 0,
  });

  useEffect(() => {
    const agent = getSelectedAgent();
    state.current.char = agent;
    loadImage(agent.idle).then((img) => {
      state.current.idleImg = img;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const flap = () => {
    if (statusRef.current === "ready") {
      start();
      return;
    }
    if (statusRef.current !== "playing") return;
    state.current.vy = FLAP;
  };

  const start = () => {
    const canvas = canvasRef.current;
    const h = canvas?.clientHeight || 520;
    const w = canvas?.clientWidth || 360;
    const s = state.current;
    s.y = h * 0.4;
    s.vy = 0;
    s.pipes = [];
    s.spawnTimer = 0.6;
    s.score = 0;
    s.dead = false;
    s.time = 0;
    s.nebulaPhase = 0;
    s.stars = buildStars(w, h);
    setScore(0);
    s.char = getSelectedAgent();
    loadImage(s.char.idle).then((img) => {
      s.idleImg = img;
    });
    setStatus("playing");
  };

  const endGame = () => {
    if (state.current.dead) return;
    state.current.dead = true;
    const next = setHighScore("flappy", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  useGameLoop(canvasRef, {
    onResize: (api) => {
      if (statusRef.current !== "playing" || state.current.stars.length === 0) {
        state.current.stars = buildStars(api.width, api.height);
      }
    },
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      s.nebulaPhase += dt * 0.12;

      for (const star of s.stars) {
        const spd = LAYER_SPEED[star.layer] ?? 30;
        star.x -= spd * dt;
        star.y += star.driftY * dt;
        if (star.y < -10) star.y = api.height + 10;
        if (star.y > api.height + 10) star.y = -10;
        if (star.x < -12) {
          const next = seedStar(star.layer, api.width, api.height, api.width + 8 + Math.random() * 40);
          star.x = next.x;
          star.y = next.y;
          star.r = next.r;
          star.phase = next.phase;
          star.twinkle = next.twinkle;
          star.driftY = next.driftY;
        }
      }

      if (statusRef.current !== "playing") return;
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;

      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = PIPE_EVERY;
        const gapH = Math.max(128, api.height * 0.24);
        const margin = 70;
        const gapY = margin + Math.random() * (api.height - margin * 2 - gapH);
        s.pipes.push({ x: api.width + 24, gapY, gapH, passed: false });
      }

      const px = api.width * 0.28;
      const pr = 20;
      for (const p of s.pipes) {
        p.x -= PIPE_SPEED * dt;
        if (!p.passed && p.x + 44 < px) {
          p.passed = true;
          s.score += 1;
          setScore(s.score);
        }
        if (p.x < px + pr && p.x + 52 > px - pr) {
          if (s.y - pr < p.gapY || s.y + pr > p.gapY + p.gapH) {
            endGame();
            return;
          }
        }
      }
      s.pipes = s.pipes.filter((p) => p.x > -90);

      if (s.y > api.height - 24 || s.y < 12) endGame();
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      drawNeonVoid(ctx, width, height, s.time, { grid: true, rails: true });

      for (let layer = 0; layer < 3; layer++) {
        for (const star of s.stars) {
          if (star.layer !== layer) continue;
          const tw =
            0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.time * star.twinkle + star.phase));
          const r = star.r * (0.75 + tw * 0.35);
          ctx.beginPath();
          if (layer === 2) ctx.fillStyle = `rgba(245,230,66,${0.28 + tw * 0.6})`;
          else if (layer === 1) ctx.fillStyle = `rgba(62,203,255,${0.22 + tw * 0.5})`;
          else ctx.fillStyle = `rgba(240,238,246,${0.15 + tw * 0.35})`;
          ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
          ctx.fill();
          if (layer === 2 && tw > 0.88) {
            ctx.strokeStyle = `rgba(245,230,66,${tw * 0.4})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(star.x - r * 2.4, star.y);
            ctx.lineTo(star.x + r * 2.4, star.y);
            ctx.moveTo(star.x, star.y - r * 2.4);
            ctx.lineTo(star.x, star.y + r * 2.4);
            ctx.stroke();
          }
        }
      }

      for (const p of s.pipes) {
        drawGate(ctx, p.x, 0, 52, p.gapY, true);
        drawGate(ctx, p.x, p.gapY + p.gapH, 52, height - (p.gapY + p.gapH), false);
      }

      ctx.strokeStyle = "rgba(62,203,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - 18);
      ctx.lineTo(width, height - 18);
      ctx.stroke();

      const px = width * 0.28;
      const size = 58;
      const bob = Math.sin(s.time * 8) * 2.5;
      ctx.save();
      ctx.translate(px, s.y + bob);
      ctx.rotate(Math.max(-0.5, Math.min(0.7, s.vy / 420)));
      if (s.idleImg) {
        drawSprite(ctx, s.idleImg, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = "#f5e642";
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (statusRef.current === "playing") {
        ctx.fillStyle = "#f5e642";
        ctx.font = "700 28px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(s.score), width / 2, 42);
      }
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
      hidePlayPilot
      pilotLocationHint="Your character flies the lanes. Tap to climb."
      hint="Tap / space to climb · thread the gaps"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
      />
    </GameCanvasShell>
  );
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  top: boolean,
) {
  if (h <= 0) return;
  ctx.fillStyle = "rgba(18,10,31,0.95)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#3ecbff";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "#3ecbff";
  ctx.shadowBlur = 12;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "rgba(45,22,84,0.2)");
  grad.addColorStop(0.5, "rgba(62,203,255,0.35)");
  grad.addColorStop(1, "rgba(45,22,84,0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(x + 4, y, w - 8, h);
  const cy = top ? y + h - 10 : y;
  ctx.fillStyle = "#f5e642";
  ctx.shadowColor = "rgba(245,230,66,0.5)";
  ctx.shadowBlur = 8;
  ctx.fillRect(x - 4, cy, w + 8, 10);
  ctx.shadowBlur = 0;
}
