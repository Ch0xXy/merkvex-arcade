import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { drawNeonVoid } from "@/games/neonFx";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { CHARACTERS, drawSprite, loadImage, type Character } from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";

type Alien = {
  col: number;
  row: number;
  alive: boolean;
  char: Character;
  flash: number;
};

type Bullet = { x: number; y: number; vy: number; from: "player" | "alien" };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const meta = getGame("invaders")!;
const COLS = 8;
const ROWS = 4;

export function InvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("invaders"));
  const [lives, setLives] = useState(3);
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    playerX: 180,
    playerW: 52,
    bullets: [] as Bullet[],
    aliens: [] as Alien[],
    particles: [] as Particle[],
    dir: 1,
    stepY: 0,
    moveAcc: 0,
    moveEvery: 0.55,
    shootCd: 0,
    alienShootAcc: 0,
    score: 0,
    lives: 3,
    wave: 1,
    keys: { left: false, right: false, fire: false },
    pilot: getSelectedAgent(),
    pilotImg: null as HTMLImageElement | null,
    images: new Map<string, HTMLImageElement>(),
    time: 0,
    invuln: 0,
  });

  const buildWave = (wave: number) => {
    const aliens: Alien[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const char = CHARACTERS[(wave * 5 + r * COLS + c) % CHARACTERS.length]!;
        aliens.push({ col: c, row: r, alive: true, char, flash: 0 });
        if (!state.current.images.has(char.id)) {
          loadImage(char.idle).then((img) => state.current.images.set(char.id, img));
        }
      }
    }
    state.current.aliens = aliens;
    state.current.dir = 1;
    state.current.moveEvery = Math.max(0.22, 0.55 - wave * 0.04);
    state.current.moveAcc = 0;
    state.current.bullets = [];
  };

  const start = () => {
    const s = state.current;
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 360;
    s.playerX = w / 2;
    s.score = 0;
    s.lives = 3;
    s.wave = 1;
    s.time = 0;
    s.invuln = 0;
    s.bullets = [];
    s.particles = [];
    setScore(0);
    setLives(3);
    s.pilot = getSelectedAgent();
    loadImage(s.pilot.idle).then((img) => {
      s.pilotImg = img;
    });
    buildWave(1);
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("invaders", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  const burst = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      state.current.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        color,
      });
    }
  };

  useEffect(() => {
    const pilot = getSelectedAgent();
    state.current.pilot = pilot;
    loadImage(pilot.idle).then((img) => {
      state.current.pilotImg = img;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        state.current.keys.left = down;
        e.preventDefault();
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        state.current.keys.right = down;
        e.preventDefault();
      }
      if (e.code === "Space") {
        state.current.keys.fire = down;
        e.preventDefault();
        if (down && statusRef.current === "ready") start();
      }
      if (down && (e.code === "Enter") && statusRef.current !== "playing") start();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useGameLoop(canvasRef, {
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      for (const p of s.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const a of s.aliens) a.flash = Math.max(0, a.flash - dt * 4);

      if (statusRef.current !== "playing") return;

      s.invuln = Math.max(0, s.invuln - dt);
      s.shootCd = Math.max(0, s.shootCd - dt);
      const speed = 280;
      if (s.keys.left) s.playerX -= speed * dt;
      if (s.keys.right) s.playerX += speed * dt;
      s.playerX = Math.max(28, Math.min(api.width - 28, s.playerX));

      if (s.keys.fire && s.shootCd <= 0) {
        s.bullets.push({ x: s.playerX, y: api.height - 70, vy: -420, from: "player" });
        s.shootCd = 0.28;
      }

      // alien formation step
      s.moveAcc += dt;
      if (s.moveAcc >= s.moveEvery) {
        s.moveAcc = 0;
        let hitEdge = false;
        for (const a of s.aliens) {
          if (!a.alive) continue;
          const nx = alienX(a, s.dir, api.width) + s.dir * 14;
          if (nx < 24 || nx > api.width - 24) hitEdge = true;
        }
        if (hitEdge) {
          s.dir *= -1;
          s.stepY += 18;
          s.moveEvery = Math.max(0.16, s.moveEvery * 0.94);
        } else {
          for (const a of s.aliens) {
            if (a.alive) a.col += s.dir * 0.35;
          }
        }
      }

      // alien shots
      s.alienShootAcc += dt;
      if (s.alienShootAcc > 0.9) {
        s.alienShootAcc = 0;
        const alive = s.aliens.filter((a) => a.alive);
        if (alive.length) {
          const a = alive[Math.floor(Math.random() * alive.length)]!;
          s.bullets.push({
            x: alienX(a, 0, api.width),
            y: alienY(a, s.stepY) + 20,
            vy: 180 + s.wave * 12,
            from: "alien",
          });
        }
      }

      for (const b of s.bullets) {
        b.y += b.vy * dt;
      }

      // collisions
      for (const b of s.bullets) {
        if (b.from === "player") {
          for (const a of s.aliens) {
            if (!a.alive) continue;
            const ax = alienX(a, 0, api.width);
            const ay = alienY(a, s.stepY);
            if (Math.abs(b.x - ax) < 22 && Math.abs(b.y - ay) < 22) {
              a.alive = false;
              a.flash = 1;
              b.y = -999;
              const pts = a.char.points;
              s.score += pts;
              setScore(s.score);
              burst(ax, ay, a.char.accent);
            }
          }
        } else if (s.invuln <= 0) {
          if (Math.abs(b.x - s.playerX) < 26 && Math.abs(b.y - (api.height - 48)) < 24) {
            b.y = 9999;
            s.lives -= 1;
            setLives(s.lives);
            s.invuln = 1.4;
            burst(s.playerX, api.height - 48, "#ff4d6d");
            if (s.lives <= 0) endGame();
          }
        }
      }
      s.bullets = s.bullets.filter((b) => b.y > -20 && b.y < api.height + 40);

      // invasion line
      for (const a of s.aliens) {
        if (a.alive && alienY(a, s.stepY) > api.height - 100) {
          endGame();
          return;
        }
      }

      if (s.aliens.every((a) => !a.alive)) {
        s.wave += 1;
        s.score += 100 * s.wave;
        setScore(s.score);
        s.stepY = 0;
        buildWave(s.wave);
      }
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      drawNeonVoid(ctx, width, height, s.time, { grid: true, rails: true });

      // vault line
      ctx.strokeStyle = "rgba(245,230,66,0.45)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, height - 90);
      ctx.lineTo(width, height - 90);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const a of s.aliens) {
        if (!a.alive && a.flash <= 0) continue;
        const x = alienX(a, 0, width);
        const y = alienY(a, s.stepY);
        const img = s.images.get(a.char.id);
        const size = 36;
        if (a.alive || a.flash > 0) {
          ctx.globalAlpha = a.alive ? 1 : a.flash;
          ctx.shadowColor = a.char.accent;
          ctx.shadowBlur = 12;
          if (img) drawSprite(ctx, img, x - size / 2, y - size / 2, size, size);
          else {
            ctx.fillStyle = a.char.accent;
            ctx.fillRect(x - 14, y - 14, 28, 28);
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      for (const b of s.bullets) {
        ctx.shadowColor = b.from === "player" ? "#f5e642" : "#ff2bd6";
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.from === "player" ? "#f5e642" : "#ff2bd6";
        ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
        ctx.shadowBlur = 0;
      }

      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // player pilot
      const py = height - 52;
      if (s.invuln > 0 && Math.floor(s.time * 12) % 2 === 0) {
        /* blink */
      } else {
        ctx.shadowColor = s.pilot.accent;
        ctx.shadowBlur = 16;
        if (s.pilotImg) drawSprite(ctx, s.pilotImg, s.playerX - 28, py - 28, 56, 56);
        else {
          ctx.fillStyle = "#f5e642";
          ctx.beginPath();
          ctx.arc(s.playerX, py, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      if (statusRef.current === "playing") {
        ctx.fillStyle = "#3ecbff";
        ctx.font = "700 12px Orbitron, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`WAVE ${s.wave}`, 12, 22);
        ctx.fillStyle = "#ff2bd6";
        ctx.fillText(`♥ ${s.lives}`, 12, 40);
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
        setLives(3);
      }}
      onStart={start}
      hidePlayPilot
      pilotLocationHint="Your character is the ship. Move and shoot the swarm."
      hint={`Hold the line · ${lives} lives · space to fire`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          state.current.playerX = e.clientX - rect.left;
        }}
        onPointerDown={() => {
          if (statusRef.current === "ready") start();
          else if (statusRef.current === "playing") {
            state.current.keys.fire = true;
            state.current.shootCd = 0;
          }
        }}
        onPointerUp={() => {
          state.current.keys.fire = false;
        }}
      />
    </GameCanvasShell>
  );
}

function alienX(a: Alien, _dir: number, width: number) {
  const margin = 36;
  const span = width - margin * 2;
  const cell = span / COLS;
  return margin + (a.col + 0.5) * cell;
}

function alienY(a: Alien, stepY: number) {
  return 56 + a.row * 44 + stepY;
}
