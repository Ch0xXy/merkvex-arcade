import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import {
  drawSprite,
  loadImage,
  pickWeightedCharacter,
  type Character,
} from "@/lib/characters";
import { drawNeonVoid, hexToRgba } from "@/games/neonFx";
import { getHighScore, setHighScore } from "@/lib/scores";

type Platform = {
  x: number;
  y: number;
  w: number;
  type: "normal" | "move" | "break";
  phase: number;
};
type Pickup = { x: number; y: number; char: Character; taken: boolean };

const meta = getGame("jumper")!;
const GRAVITY = 1500;
const JUMP = -640;
const MAX_GAP = 108;
const MIN_GAP = 44;
const MAX_SPEED = 480;
const KEY_SPEED = 440;
const AIR_LERP = 22;
const FRICTION = 0.84;

export function JumperGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("jumper"));
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    x: 180,
    y: 400,
    vx: 0,
    vy: 0,
    platforms: [] as Platform[],
    pickups: [] as Pickup[],
    cameraY: 0,
    bestY: 0,
    startY: 0,
    heightPts: 0,
    bonusPts: 0,
    keys: { left: false, right: false },
    pointerX: null as number | null,
    char: getSelectedAgent(),
    idleImg: null as HTMLImageElement | null,
    pickupImgs: new Map<string, HTMLImageElement>(),
    facing: 1,
    time: 0,
    lastPlat: { x: 0, y: 0, w: 110 } as { x: number; y: number; w: number },
    difficulty: 0,
  });

  const spawnPlatforms = (w: number, fromY: number, toY: number) => {
    const s = state.current;
    let y = fromY;
    let prevX = s.lastPlat.x + s.lastPlat.w / 2;
    const maxDx = Math.min(w * 0.42, 160 + Math.min(80, s.difficulty * 4));

    while (y > toY) {
      const gapMax = Math.min(MAX_GAP, MIN_GAP + 28 + s.difficulty * 1.2);
      const gap = MIN_GAP + Math.random() * (gapMax - MIN_GAP);
      y -= gap;

      const minW = Math.max(58, 96 - s.difficulty * 0.8);
      const maxW = Math.max(minW + 12, 120 - s.difficulty * 0.5);
      const pw = minW + Math.random() * (maxW - minW);

      const bias = (Math.random() - 0.5) * 2;
      let cx = prevX + bias * maxDx;
      cx = Math.max(pw / 2 + 10, Math.min(w - pw / 2 - 10, cx));
      if (Math.abs(cx - prevX) > maxDx) {
        cx = prevX + Math.sign(cx - prevX || 1) * maxDx * 0.85;
        cx = Math.max(pw / 2 + 10, Math.min(w - pw / 2 - 10, cx));
      }
      const px = cx - pw / 2;

      let type: Platform["type"] = "normal";
      const roll = Math.random();
      const lastBreak =
        s.platforms.length > 0 && s.platforms[s.platforms.length - 1]!.type === "break";
      if (s.difficulty > 8 && !lastBreak && roll > 0.88) type = "break";
      else if (s.difficulty > 4 && roll > 0.78) type = "move";
      if (s.platforms.length % 5 === 0) type = "normal";

      s.platforms.push({
        x: px,
        y,
        w: type === "break" ? Math.max(52, pw * 0.9) : pw,
        type,
        phase: Math.random() * Math.PI * 2,
      });

      if (Math.random() > 0.55 && type !== "break") {
        const char = pickWeightedCharacter();
        s.pickups.push({ x: px + pw / 2, y: y - 30, char, taken: false });
        if (!s.pickupImgs.has(char.id)) {
          loadImage(char.idle).then((img) => s.pickupImgs.set(char.id, img));
        }
      }

      prevX = cx;
      s.lastPlat = { x: px, y, w: pw };
      s.difficulty += 0.35;
    }
  };

  const publishScore = () => {
    const s = state.current;
    setScore(s.heightPts + s.bonusPts);
  };

  const startGame = () => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 360;
    const h = canvas?.clientHeight || 520;
    const s = state.current;
    s.x = w / 2;
    s.y = h - 90;
    s.vx = 0;
    s.vy = 0;
    s.cameraY = 0;
    s.startY = s.y;
    s.bestY = s.y;
    s.heightPts = 0;
    s.bonusPts = 0;
    s.time = 0;
    s.difficulty = 0;
    s.keys.left = false;
    s.keys.right = false;
    const startPlat: Platform = {
      x: w / 2 - 60,
      y: h - 48,
      w: 120,
      type: "normal",
      phase: 0,
    };
    s.platforms = [startPlat];
    s.lastPlat = { x: startPlat.x, y: startPlat.y, w: startPlat.w };
    s.pickups = [];
    s.pointerX = null;
    setScore(0);
    spawnPlatforms(w, startPlat.y, -h * 2.5);
    s.char = getSelectedAgent();
    loadImage(s.char.idle).then((img) => {
      s.idleImg = img;
    });
    setStatus("playing");
  };

  const endGame = () => {
    const total = state.current.heightPts + state.current.bonusPts;
    const next = setHighScore("jumper", total);
    setHigh(next);
    setStatus("over");
  };

  useEffect(() => {
    const agent = getSelectedAgent();
    state.current.char = agent;
    loadImage(agent.idle).then((img) => {
      state.current.idleImg = img;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        state.current.keys.left = true;
        e.preventDefault();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        state.current.keys.right = true;
        e.preventDefault();
      } else if ((e.code === "Space" || e.code === "Enter") && statusRef.current !== "playing") {
        startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        state.current.keys.left = false;
        e.preventDefault();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        state.current.keys.right = false;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useGameLoop(canvasRef, {
    update: (dt, api) => {
      if (statusRef.current !== "playing") return;
      const s = state.current;
      s.time += dt;

      let targetVx = 0;
      if (s.keys.left && !s.keys.right) targetVx = -KEY_SPEED;
      else if (s.keys.right && !s.keys.left) targetVx = KEY_SPEED;

      if (s.pointerX != null) {
        const dx = s.pointerX - s.x;
        targetVx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, dx * 11));
        if (Math.abs(dx) < 5) targetVx = 0;
      }

      if (s.keys.left || s.keys.right || s.pointerX != null) {
        const t = 1 - Math.exp(-AIR_LERP * dt);
        s.vx = s.vx + (targetVx - s.vx) * t;
        if (targetVx !== 0 && Math.sign(s.vx) !== 0 && Math.sign(targetVx) !== Math.sign(s.vx)) {
          s.vx = targetVx * 0.7;
        }
      } else {
        s.vx *= Math.pow(FRICTION, dt * 60);
        if (Math.abs(s.vx) < 6) s.vx = 0;
      }

      s.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, s.vx));
      if (Math.abs(s.vx) > 10) s.facing = s.vx > 0 ? 1 : -1;

      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.x < -20) s.x = api.width + 20;
      if (s.x > api.width + 20) s.x = -20;

      for (const p of s.platforms) {
        if (p.type === "move") {
          p.phase += dt;
          p.x += Math.sin(p.phase * 1.8) * 40 * dt;
          p.x = Math.max(8, Math.min(api.width - p.w - 8, p.x));
        }
        if (s.vy > 0) {
          const feet = s.y + 24;
          if (
            s.x > p.x - 6 &&
            s.x < p.x + p.w + 6 &&
            feet > p.y &&
            feet < p.y + 20 &&
            s.y - s.vy * dt <= p.y + 8
          ) {
            s.y = p.y - 24;
            s.vy = JUMP;
            if (p.type === "break") p.y = 1e6;
          }
        }
      }

      for (const pk of s.pickups) {
        if (pk.taken) continue;
        if (Math.hypot(s.x - pk.x, s.y - pk.y) < 32) {
          pk.taken = true;
          s.bonusPts += pk.char.points;
          publishScore();
        }
      }

      const viewY = s.y - api.height * 0.42;
      if (viewY < s.cameraY) s.cameraY = viewY;

      if (s.y < s.bestY) {
        s.bestY = s.y;
        s.heightPts = Math.max(0, Math.floor((s.startY - s.bestY) / 8));
        publishScore();
      }

      const topPlat = Math.min(...s.platforms.map((p) => p.y));
      if (topPlat > s.cameraY - 40) {
        spawnPlatforms(api.width, topPlat, s.cameraY - api.height * 1.2);
      }
      s.platforms = s.platforms.filter((p) => p.y < s.cameraY + api.height + 100);
      s.pickups = s.pickups.filter((p) => !p.taken && p.y < s.cameraY + api.height + 100);

      if (s.y > s.cameraY + api.height + 50) endGame();
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      const cam = s.cameraY;

      drawNeonVoid(ctx, width, height, s.time, { grid: true, rails: true });

      // parallax spark dust
      for (let i = 0; i < 40; i++) {
        const x = ((i * 67 + cam * 0.02) % width + width) % width;
        const y = ((i * 91 - cam * 0.25) % height + height) % height;
        const col = i % 3 === 0 ? "#f5e642" : i % 3 === 1 ? "#3ecbff" : "#ff2bd6";
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const p of s.platforms) {
        const sy = p.y - cam;
        if (sy < -24 || sy > height + 24) continue;
        ctx.fillStyle =
          p.type === "break"
            ? "rgba(255,77,109,0.9)"
            : p.type === "move"
              ? "rgba(62,203,255,0.92)"
              : "rgba(245,230,66,0.92)";
        ctx.shadowColor = String(ctx.fillStyle);
        ctx.shadowBlur = 16;
        roundRect(ctx, p.x, sy, p.w, 13, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const pk of s.pickups) {
        if (pk.taken) continue;
        const sy = pk.y - cam;
        if (sy < -50 || sy > height + 50) continue;
        const bob = Math.sin(s.time * 4 + pk.x * 0.05) * 3;
        const img = s.pickupImgs.get(pk.char.id);
        if (img) drawSprite(ctx, img, pk.x - 22, sy - 22 + bob, 44, 44);
        else {
          ctx.fillStyle = pk.char.accent;
          ctx.beginPath();
          ctx.arc(pk.x, sy + bob, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const py = s.y - cam;
      const size = 60;
      const bob = Math.sin(s.time * 6) * (Math.abs(s.vx) > 20 ? 2 : 1);
      const stretch = 1 + Math.min(0.1, Math.abs(s.vy) / 2400);
      ctx.save();
      ctx.translate(s.x, py + bob);
      ctx.scale(s.facing * (2 - stretch), stretch);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(0, size * 0.42, size * 0.28, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (s.idleImg) {
        drawSprite(ctx, s.idleImg, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = "#f5e642";
        ctx.fillRect(-14, -18, 28, 36);
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
      onStart={startGame}
      hidePlayPilot
      pilotLocationHint="Your character bounces the pads. Grab pickups for combos."
      hint="A/D or drag · climb forever"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        onPointerDown={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.focus();
          const rect = canvas.getBoundingClientRect();
          state.current.pointerX = e.clientX - rect.left;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          if (statusRef.current === "ready") startGame();
        }}
        onPointerMove={(e) => {
          if (state.current.pointerX == null) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          state.current.pointerX = e.clientX - rect.left;
        }}
        onPointerUp={() => {
          state.current.pointerX = null;
        }}
        onPointerCancel={() => {
          state.current.pointerX = null;
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
