import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { drawNeonVoid } from "@/games/neonFx";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { drawSprite, loadImage } from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";

type LaneObj = {
  lane: number;
  z: number;
  kind: "junk" | "charge" | "rare";
  w: number;
  h: number;
};

const meta = getGame("runner")!;
const LANES = 3;

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("runner"));
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    lane: 1,
    targetLane: 1,
    laneX: 0,
    objects: [] as LaneObj[],
    speed: 220,
    dist: 0,
    score: 0,
    spawnAcc: 0,
    time: 0,
    pilot: getSelectedAgent(),
    pilotImg: null as HTMLImageElement | null,
    bob: 0,
    invuln: 0,
    touchStartX: null as number | null,
  });

  const start = () => {
    const s = state.current;
    s.lane = 1;
    s.targetLane = 1;
    s.objects = [];
    s.speed = 240;
    s.dist = 0;
    s.score = 0;
    s.spawnAcc = 0;
    s.time = 0;
    s.invuln = 0;
    setScore(0);
    s.pilot = getSelectedAgent();
    loadImage(s.pilot.idle).then((img) => {
      s.pilotImg = img;
    });
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("runner", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  const setLane = (lane: number) => {
    state.current.targetLane = Math.max(0, Math.min(LANES - 1, lane));
  };

  useEffect(() => {
    loadImage(getSelectedAgent().idle).then((img) => {
      state.current.pilotImg = img;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        if (statusRef.current === "ready") start();
        setLane(state.current.targetLane - 1);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        if (statusRef.current === "ready") start();
        setLane(state.current.targetLane + 1);
      }
      if (e.code === "Digit1") setLane(0);
      if (e.code === "Digit2") setLane(1);
      if (e.code === "Digit3") setLane(2);
      if ((e.code === "Space" || e.code === "Enter") && statusRef.current !== "playing") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useGameLoop(canvasRef, {
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      s.bob += dt * 10;
      if (statusRef.current !== "playing") return;

      s.invuln = Math.max(0, s.invuln - dt);
      s.speed = Math.min(430, 220 + s.dist * 0.009);
      s.dist += s.speed * dt;
      s.score = Math.floor(s.dist / 8);
      setScore(s.score);

      // smooth lane
      const laneW = api.width / LANES;
      const targetX = laneW * s.targetLane + laneW / 2;
      s.laneX += (targetX - s.laneX) * Math.min(1, dt * 14);
      s.lane = s.targetLane;

      // Player sits mid-low — not glued to the bottom — for reaction time
      const playerY = api.height * 0.58;

      s.spawnAcc += dt;
      const every = Math.max(0.48, 0.95 - s.dist * 0.00003);
      if (s.spawnAcc >= every) {
        s.spawnAcc = 0;
        spawnSafeWave(s, api.height);
      }

      for (const o of s.objects) {
        // approach from the top of the screen toward the pilot
        o.z += s.speed * dt;
        if (o.z > playerY - 36 && o.z < playerY + 36 && o.lane === s.targetLane) {
          if (o.kind === "junk") {
            if (s.invuln <= 0) {
              o.z = 9999;
              endGame();
            }
          } else {
            o.z = 9999;
            s.score += o.kind === "rare" ? 50 : 15;
            s.dist += o.kind === "rare" ? 80 : 20;
            setScore(s.score);
          }
        }
      }
      s.objects = s.objects.filter((o) => o.z < api.height + 80);
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      drawNeonVoid(ctx, width, height, s.time, { grid: true, rails: true });

      const laneW = width / LANES;
      // lanes
      for (let i = 0; i < LANES; i++) {
        const x = i * laneW;
        ctx.fillStyle = i === s.targetLane ? "rgba(245,230,66,0.06)" : "rgba(62,203,255,0.03)";
        ctx.fillRect(x, 0, laneW, height);
        ctx.strokeStyle = "rgba(62,203,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,43,214,0.35)";
      ctx.beginPath();
      ctx.moveTo(width - 1, 0);
      ctx.lineTo(width - 1, height);
      ctx.stroke();

      // road dashes
      const scroll = (s.dist * 0.4) % 40;
      for (let i = 0; i < LANES; i++) {
        const cx = i * laneW + laneW / 2;
        for (let y = -40; y < height; y += 40) {
          ctx.fillStyle = "rgba(245,230,66,0.25)";
          ctx.fillRect(cx - 2, y + scroll, 4, 18);
        }
      }

      // objects
      for (const o of s.objects) {
        const x = o.lane * laneW + laneW / 2;
        const y = o.z;
        if (o.kind === "junk") {
          ctx.shadowColor = "#ff2bd6";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "rgba(255,43,214,0.85)";
          roundRect(ctx, x - o.w / 2, y - o.h / 2, o.w, o.h, 8);
          ctx.fill();
          ctx.strokeStyle = "#f5e642";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#0a0612";
          ctx.font = "800 12px Orbitron, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("X", x, y + 4);
        } else {
          const col = o.kind === "rare" ? "#f5e642" : "#3ecbff";
          ctx.shadowColor = col;
          ctx.shadowBlur = 14;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, o.kind === "rare" ? 12 : 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // player
      const px = s.laneX || width / 2;
      const py = height * 0.58 + Math.sin(s.bob) * 3;
      ctx.shadowColor = s.pilot.accent;
      ctx.shadowBlur = 18;
      if (s.pilotImg) drawSprite(ctx, s.pilotImg, px - 34, py - 40, 68, 68);
      else {
        ctx.fillStyle = "#f5e642";
        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // pad under feet
      ctx.fillStyle = "rgba(62,203,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(px, py + 28, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (statusRef.current === "playing") {
        ctx.fillStyle = "#3ecbff";
        ctx.font = "700 12px Orbitron, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${Math.floor(s.speed)} u/s`, 12, 24);
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
      pilotLocationHint="Your character runs the lanes. Swap to dodge. Scoop charge."
      hint="← → lanes · scoop cyan/yellow · dodge pink junk"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          if (statusRef.current === "ready") start();
          state.current.touchStartX = e.clientX;
        }}
        onPointerUp={(e) => {
          const startX = state.current.touchStartX;
          state.current.touchStartX = null;
          if (startX == null) return;
          const dx = e.clientX - startX;
          if (Math.abs(dx) < 24) {
            // tap lane under finger
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            setLane(Math.floor((x / rect.width) * LANES));
            return;
          }
          setLane(state.current.targetLane + (dx > 0 ? 1 : -1));
        }}
      />
    </GameCanvasShell>
  );
}

/** Never fill all 3 lanes with junk in one band — always leave an escape lane. */
function spawnSafeWave(
  s: {
    objects: LaneObj[];
  },
  height: number,
) {
  const lanes = [0, 1, 2];
  // shuffle
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = lanes[i]!;
    lanes[i] = lanes[j]!;
    lanes[j] = tmp;
  }

  // 1 junk guaranteed-ish, sometimes 2 — never 3
  const junkCount = Math.random() > 0.55 ? 2 : 1;
  const z = -50 - Math.random() * 40;

  // also refuse if nearby junk already blocks the only free lanes
  const nearJunkLanes = new Set(
    s.objects
      .filter((o) => o.kind === "junk" && o.z < 160)
      .map((o) => o.lane),
  );

  const junkLanes: number[] = [];
  for (const lane of lanes) {
    if (junkLanes.length >= junkCount) break;
    // if adding this would mean all 3 lanes have near junk, skip
    const blocked = new Set([...nearJunkLanes, ...junkLanes, lane]);
    if (blocked.size >= LANES) continue;
    junkLanes.push(lane);
  }
  // ensure at least one junk if none near
  if (junkLanes.length === 0 && nearJunkLanes.size < 2) {
    junkLanes.push(lanes[0]!);
  }

  for (const lane of junkLanes) {
    s.objects.push({
      lane,
      z,
      kind: "junk",
      w: 44,
      h: 38,
    });
  }

  // optional pickups only on the safe lane(s)
  const free = lanes.filter((l) => !junkLanes.includes(l) && !nearJunkLanes.has(l));
  if (free.length && Math.random() > 0.35) {
    const lane = free[Math.floor(Math.random() * free.length)]!;
    const rare = Math.random() > 0.78;
    s.objects.push({
      lane,
      z: z - 30 - Math.random() * 20,
      kind: rare ? "rare" : "charge",
      w: rare ? 30 : 26,
      h: rare ? 30 : 26,
    });
  }
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
