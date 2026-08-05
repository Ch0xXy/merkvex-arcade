import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { drawSprite, loadImage } from "@/lib/characters";
import { drawNeonVoid, hexToRgba } from "@/games/neonFx";
import { getHighScore, setHighScore } from "@/lib/scores";

type Point = { x: number; y: number };
type Dir = { x: number; y: number };
type Pod = { x: number; y: number; kind: "cyan" | "yellow" | "violet"; value: number };

const meta = getGame("snake")!;
const CELL = 22;

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("snake"));
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    snake: [{ x: 8, y: 10 }] as Point[],
    dir: { x: 1, y: 0 } as Dir,
    nextDir: { x: 1, y: 0 } as Dir,
    pod: { x: 14, y: 10, kind: "cyan" as const, value: 10 } as Pod,
    cols: 18,
    rows: 22,
    acc: 0,
    /* 0.14 → ~0.156: ~10% slower base tick (scale 10 → 9) */
    step: 0.1556,
    score: 0,
    grow: 0,
    touchStart: null as Point | null,
    time: 0,
    pilotImg: null as HTMLImageElement | null,
    pilotAccent: "#f5e642",
  });

  const placePod = (cols: number, rows: number) => {
    const s = state.current;
    const occupied = new Set(s.snake.map((p) => `${p.x},${p.y}`));
    let x = 0,
      y = 0,
      tries = 0;
    do {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
      tries++;
    } while (occupied.has(`${x},${y}`) && tries < 200);
    const roll = Math.random();
    const kind: Pod["kind"] = roll > 0.85 ? "violet" : roll > 0.55 ? "yellow" : "cyan";
    const value = kind === "violet" ? 40 : kind === "yellow" ? 20 : 10;
    s.pod = { x, y, kind, value };
  };

  const startGame = () => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 360;
    const h = canvas?.clientHeight || 520;
    const s = state.current;
    s.cols = Math.max(12, Math.floor(w / CELL));
    s.rows = Math.max(16, Math.floor(h / CELL));
    const cx = Math.floor(s.cols / 2);
    const cy = Math.floor(s.rows / 2);
    s.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    s.dir = { x: 1, y: 0 };
    s.nextDir = { x: 1, y: 0 };
    s.score = 0;
    s.grow = 0;
    s.acc = 0;
    s.step = 0.1556;
    s.time = 0;
    setScore(0);
    placePod(s.cols, s.rows);
    const pilot = getSelectedAgent();
    s.pilotAccent = pilot.accent;
    loadImage(pilot.idle).then((img) => {
      s.pilotImg = img;
    });
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("snake", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  const setDir = (nx: number, ny: number) => {
    const s = state.current;
    if (s.dir.x + nx === 0 && s.dir.y + ny === 0) return;
    s.nextDir = { x: nx, y: ny };
  };

  useEffect(() => {
    const pilot = getSelectedAgent();
    state.current.pilotAccent = pilot.accent;
    loadImage(pilot.idle).then((img) => {
      state.current.pilotImg = img;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        KeyW: [0, -1],
        ArrowDown: [0, 1],
        KeyS: [0, 1],
        ArrowLeft: [-1, 0],
        KeyA: [-1, 0],
        ArrowRight: [1, 0],
        KeyD: [1, 0],
      };
      const d = map[e.code];
      if (d) {
        e.preventDefault();
        if (statusRef.current === "ready") startGame();
        else setDir(d[0], d[1]);
      }
      if ((e.code === "Space" || e.code === "Enter") && statusRef.current !== "playing") {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useGameLoop(canvasRef, {
    onResize: (api) => {
      if (statusRef.current !== "playing") {
        state.current.cols = Math.max(12, Math.floor(api.width / CELL));
        state.current.rows = Math.max(16, Math.floor(api.height / CELL));
      }
    },
    update: (dt) => {
      const s = state.current;
      s.time += dt;
      if (statusRef.current !== "playing") return;
      s.acc += dt;
      while (s.acc >= s.step) {
        s.acc -= s.step;
        s.dir = s.nextDir;
        const head = s.snake[0]!;
        const nx = head.x + s.dir.x;
        const ny = head.y + s.dir.y;
        if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) {
          endGame();
          return;
        }
        if (s.snake.some((p) => p.x === nx && p.y === ny)) {
          endGame();
          return;
        }
        s.snake.unshift({ x: nx, y: ny });
        if (nx === s.pod.x && ny === s.pod.y) {
          s.score += s.pod.value;
          setScore(s.score);
          s.grow += s.pod.kind === "violet" ? 3 : s.pod.kind === "yellow" ? 2 : 1;
          s.step = Math.max(0.0778, s.step * 0.985);
          placePod(s.cols, s.rows);
        } else if (s.grow > 0) {
          s.grow -= 1;
        } else {
          s.snake.pop();
        }
      }
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      const ox = (width - s.cols * CELL) / 2;
      const oy = (height - s.rows * CELL) / 2;

      drawNeonVoid(ctx, width, height, s.time, { grid: false, rails: true });

      // neon playfield plate
      ctx.fillStyle = "rgba(12,6,28,0.88)";
      ctx.shadowColor = "#3ecbff";
      ctx.shadowBlur = 18;
      ctx.fillRect(ox - 2, oy - 2, s.cols * CELL + 4, s.rows * CELL + 4);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hexToRgba("#3ecbff", 0.55);
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 2, oy - 2, s.cols * CELL + 4, s.rows * CELL + 4);
      ctx.strokeStyle = "rgba(62,203,255,0.14)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= s.cols; x++) {
        ctx.beginPath();
        ctx.moveTo(ox + x * CELL, oy);
        ctx.lineTo(ox + x * CELL, oy + s.rows * CELL);
        ctx.stroke();
      }
      for (let y = 0; y <= s.rows; y++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + y * CELL);
        ctx.lineTo(ox + s.cols * CELL, oy + y * CELL);
        ctx.stroke();
      }

      // energy pod
      const fx = ox + s.pod.x * CELL + CELL / 2;
      const fy = oy + s.pod.y * CELL + CELL / 2;
      const pulse = 0.85 + 0.15 * Math.sin(s.time * 6);
      const podColor =
        s.pod.kind === "violet" ? "#c084fc" : s.pod.kind === "yellow" ? "#f5e642" : "#3ecbff";
      const aura = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL * 0.72 * pulse);
      aura.addColorStop(0, podColor);
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.72 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = podColor;
      ctx.shadowBlur = 14;
      const rg = ctx.createRadialGradient(fx - 3, fy - 3, 1, fx, fy, CELL * 0.28);
      rg.addColorStop(0, "#ffffff");
      rg.addColorStop(0.45, podColor);
      rg.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.28 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.pod.value), fx, fy);

      // snake body
      s.snake.forEach((p, i) => {
        const x = ox + p.x * CELL;
        const y = oy + p.y * CELL;
        const t = i / Math.max(1, s.snake.length);
        ctx.fillStyle = i === 0 ? "#f5e642" : `rgba(62,203,255,${1 - t * 0.55})`;
        ctx.shadowColor = i === 0 ? s.pilotAccent : "#3ecbff";
        ctx.shadowBlur = i === 0 ? 14 : 5;
        const pad = i === 0 ? 1 : 3;
        roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (i === 0) {
          // pilot face is the head location
          if (s.pilotImg) {
            const size = CELL * 1.35;
            drawSprite(
              ctx,
              s.pilotImg,
              x + CELL / 2 - size / 2,
              y + CELL / 2 - size / 2 - 2,
              size,
              size,
            );
          } else {
            ctx.fillStyle = "#0a0612";
            const eye = 2.8;
            const ex = s.dir.x !== 0 ? (s.dir.x > 0 ? 0.62 : 0.28) : 0.35;
            const ey = s.dir.y !== 0 ? (s.dir.y > 0 ? 0.62 : 0.28) : 0.35;
            ctx.beginPath();
            ctx.arc(x + CELL * ex, y + CELL * ey, eye, 0, Math.PI * 2);
            ctx.arc(
              x + CELL * (ex + (s.dir.y !== 0 ? 0.28 : 0)),
              y + CELL * (ey + (s.dir.x !== 0 ? 0.28 : 0)),
              eye,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      });
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
      pilotLocationHint="Your character is the coil head. Guide them. Don't hit walls."
      hint="WASD / arrows / swipe · eat orbs · grow"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          state.current.touchStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          if (statusRef.current === "ready") startGame();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          const start = state.current.touchStart;
          state.current.touchStart = null;
          if (!start) return;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const dx = e.clientX - rect.left - start.x;
          const dy = e.clientY - rect.top - start.y;
          if (Math.hypot(dx, dy) < 18) return;
          if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
          else setDir(0, dy > 0 ? 1 : -1);
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
