import { useEffect, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { drawNeonVoid, hexToRgba } from "@/games/neonFx";
import { useGameLoop } from "@/games/useGameLoop";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { CHARACTERS, drawSprite, loadImage, type Character } from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";

type Point = { x: number; y: number };
type Cell = { gx: number; gy: number };
type Enemy = {
  t: number;
  hp: number;
  maxHp: number;
  speed: number;
  value: number;
  color: string;
  kind: "glitch" | "swift" | "tank" | "boss";
};
type Tower = {
  gx: number;
  gy: number;
  char: Character;
  range: number;
  dps: number;
  cd: number;
  img?: HTMLImageElement;
};
type Shot = { x: number; y: number; tx: number; ty: number; life: number; color: string };

type LevelDef = {
  id: number;
  name: string;
  /** Path as grid cells (entry → core). */
  path: Cell[];
  /** Preferred free starter pad (gx, gy). */
  starter: Cell;
  /** Waves to clear before next level. */
  waves: number;
  blurb: string;
};

const meta = getGame("tower")!;
const COLS = 7;
const ROWS = 9;
const TOWER_COST = 55;

const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Gate Run",
    blurb: "S-bend mid lanes · outer pads free to shoot",
    waves: 3,
    starter: { gx: 0, gy: 3 },
    path: [
      { gx: 3, gy: 0 },
      { gx: 3, gy: 1 },
      { gx: 3, gy: 2 },
      { gx: 2, gy: 2 },
      { gx: 1, gy: 2 },
      { gx: 1, gy: 3 },
      { gx: 1, gy: 4 },
      { gx: 1, gy: 5 },
      { gx: 2, gy: 5 },
      { gx: 3, gy: 5 },
      { gx: 4, gy: 5 },
      { gx: 5, gy: 5 },
      { gx: 5, gy: 6 },
      { gx: 5, gy: 7 },
      { gx: 4, gy: 7 },
      { gx: 3, gy: 7 },
      { gx: 2, gy: 7 },
      { gx: 2, gy: 8 },
      { gx: 3, gy: 8 },
      { gx: 4, gy: 8 },
    ],
  },
  {
    id: 2,
    name: "Double Bend",
    blurb: "Double U · outer pads cover every turn",
    waves: 3,
    starter: { gx: 0, gy: 3 },
    path: [
      { gx: 1, gy: 0 },
      { gx: 2, gy: 0 },
      { gx: 3, gy: 0 },
      { gx: 4, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 1 },
      { gx: 5, gy: 2 },
      { gx: 4, gy: 2 },
      { gx: 3, gy: 2 },
      { gx: 2, gy: 2 },
      { gx: 1, gy: 2 },
      { gx: 1, gy: 3 },
      { gx: 1, gy: 4 },
      { gx: 2, gy: 4 },
      { gx: 3, gy: 4 },
      { gx: 4, gy: 4 },
      { gx: 5, gy: 4 },
      { gx: 5, gy: 5 },
      { gx: 5, gy: 6 },
      { gx: 4, gy: 6 },
      { gx: 3, gy: 6 },
      { gx: 2, gy: 6 },
      { gx: 1, gy: 6 },
      { gx: 1, gy: 7 },
      { gx: 1, gy: 8 },
      { gx: 2, gy: 8 },
      { gx: 3, gy: 8 },
      { gx: 4, gy: 8 },
      { gx: 5, gy: 8 },
    ],
  },
  {
    id: 3,
    name: "Prism Coil",
    blurb: "Long coil · edge towers are MVPs",
    waves: 4,
    starter: { gx: 0, gy: 4 },
    path: [
      { gx: 2, gy: 0 },
      { gx: 2, gy: 1 },
      { gx: 2, gy: 2 },
      { gx: 2, gy: 3 },
      { gx: 3, gy: 3 },
      { gx: 4, gy: 3 },
      { gx: 4, gy: 2 },
      { gx: 4, gy: 1 },
      { gx: 5, gy: 1 },
      { gx: 5, gy: 2 },
      { gx: 5, gy: 3 },
      { gx: 5, gy: 4 },
      { gx: 5, gy: 5 },
      { gx: 5, gy: 6 },
      { gx: 4, gy: 6 },
      { gx: 3, gy: 6 },
      { gx: 2, gy: 6 },
      { gx: 1, gy: 6 },
      { gx: 1, gy: 7 },
      { gx: 1, gy: 8 },
      { gx: 2, gy: 8 },
      { gx: 3, gy: 8 },
      { gx: 4, gy: 8 },
      { gx: 4, gy: 7 },
      { gx: 4, gy: 6 },
      { gx: 4, gy: 5 },
      { gx: 3, gy: 5 },
      { gx: 3, gy: 6 },
      { gx: 3, gy: 7 },
      { gx: 3, gy: 8 },
    ],
  },
  {
    id: 4,
    name: "Void Spiral",
    blurb: "Spiral arms · tanks + swift glitches",
    waves: 4,
    starter: { gx: 6, gy: 4 },
    path: [
      { gx: 1, gy: 0 },
      { gx: 2, gy: 0 },
      { gx: 3, gy: 0 },
      { gx: 4, gy: 0 },
      { gx: 5, gy: 0 },
      { gx: 5, gy: 1 },
      { gx: 5, gy: 2 },
      { gx: 5, gy: 3 },
      { gx: 4, gy: 3 },
      { gx: 3, gy: 3 },
      { gx: 2, gy: 3 },
      { gx: 2, gy: 4 },
      { gx: 2, gy: 5 },
      { gx: 3, gy: 5 },
      { gx: 4, gy: 5 },
      { gx: 5, gy: 5 },
      { gx: 5, gy: 6 },
      { gx: 5, gy: 7 },
      { gx: 4, gy: 7 },
      { gx: 3, gy: 7 },
      { gx: 2, gy: 7 },
      { gx: 1, gy: 7 },
      { gx: 1, gy: 6 },
      { gx: 1, gy: 5 },
      { gx: 1, gy: 4 },
      { gx: 1, gy: 3 },
      { gx: 1, gy: 2 },
      { gx: 2, gy: 2 },
      { gx: 3, gy: 2 },
      { gx: 3, gy: 3 },
      { gx: 3, gy: 4 },
      { gx: 3, gy: 5 },
      { gx: 3, gy: 6 },
      { gx: 3, gy: 7 },
      { gx: 3, gy: 8 },
    ],
  },
  {
    id: 5,
    name: "Apex Gauntlet",
    blurb: "Max turns · every ring pad matters",
    waves: 5,
    starter: { gx: 6, gy: 2 },
    path: [
      { gx: 1, gy: 0 },
      { gx: 1, gy: 1 },
      { gx: 1, gy: 2 },
      { gx: 1, gy: 3 },
      { gx: 1, gy: 4 },
      { gx: 1, gy: 5 },
      { gx: 1, gy: 6 },
      { gx: 1, gy: 7 },
      { gx: 1, gy: 8 },
      { gx: 2, gy: 8 },
      { gx: 3, gy: 8 },
      { gx: 3, gy: 7 },
      { gx: 3, gy: 6 },
      { gx: 3, gy: 5 },
      { gx: 3, gy: 4 },
      { gx: 4, gy: 4 },
      { gx: 5, gy: 4 },
      { gx: 5, gy: 3 },
      { gx: 5, gy: 2 },
      { gx: 5, gy: 1 },
      { gx: 5, gy: 0 },
      { gx: 4, gy: 0 },
      { gx: 3, gy: 0 },
      { gx: 2, gy: 0 },
      { gx: 2, gy: 1 },
      { gx: 2, gy: 2 },
      { gx: 2, gy: 3 },
      { gx: 2, gy: 4 },
      { gx: 2, gy: 5 },
      { gx: 2, gy: 6 },
      { gx: 3, gy: 6 },
      { gx: 4, gy: 6 },
      { gx: 4, gy: 7 },
      { gx: 4, gy: 8 },
      { gx: 5, gy: 8 },
    ],
  },
];

function levelFor(n: number): LevelDef {
  if (n <= LEVELS.length) return LEVELS[n - 1]!;
  // Endless remix: cycle layouts with tougher names
  const base = LEVELS[(n - 1) % LEVELS.length]!;
  return {
    ...base,
    id: n,
    name: `${base.name} +${n - LEVELS.length}`,
    blurb: "Endless remix — denser spawns",
    waves: 4 + Math.floor((n - 1) / LEVELS.length),
  };
}

function towerRange(cell: number, char: Character) {
  // Reach ~2 cells so outer pads covering a serpentine lane always work
  let mult = 2.35;
  if (char.points >= 50) mult = 2.55;
  if (char.points >= 100) mult = 2.75;
  if (char.points >= 200) mult = 2.95;
  return cell * mult;
}

function towerDps(char: Character) {
  // Strong enough to clear with good placement — not to snowball a full board
  return 11 + char.points * 0.12;
}

export function TowerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("tower"));
  const [energy, setEnergy] = useState(100);
  const [core, setCore] = useState(20);
  const [levelUi, setLevelUi] = useState(1);
  const [levelName, setLevelName] = useState(LEVELS[0]!.name);
  const statusRef = useRef(status);
  statusRef.current = status;

  const state = useRef({
    towers: [] as Tower[],
    enemies: [] as Enemy[],
    shots: [] as Shot[],
    path: [] as Point[],
    pathCells: [] as Cell[],
    pathKeys: new Set<string>(),
    energy: 100,
    core: 20,
    score: 0,
    level: 1,
    waveInLevel: 0,
    wavesForLevel: LEVELS[0]!.waves,
    spawnLeft: 0,
    spawnAcc: 0,
    betweenWaves: 1.5,
    phase: "build" as "build" | "spawn" | "levelup",
    levelBanner: 0,
    cell: 48,
    ox: 0,
    oy: 0,
    time: 0,
    pilot: getSelectedAgent(),
    pilotImg: null as HTMLImageElement | null,
    nextChar: CHARACTERS[0]! as Character,
    images: new Map<string, HTMLImageElement>(),
    levelDef: LEVELS[0]! as LevelDef,
  });

  const layoutGrid = (w: number, h: number) => {
    const s = state.current;
    const cell = Math.min(52, Math.floor(Math.min(w / COLS, (h - 52) / ROWS)));
    s.cell = Math.max(36, cell);
    s.ox = (w - COLS * s.cell) / 2;
    s.oy = 44 + (h - 44 - ROWS * s.cell) / 2;
  };

  const applyLevelPath = () => {
    const s = state.current;
    const def = s.levelDef;
    s.pathCells = def.path.map((c) => ({ ...c }));
    s.pathKeys = new Set(def.path.map((c) => `${c.gx},${c.gy}`));
    s.path = def.path.map((c) => ({
      x: s.ox + c.gx * s.cell + s.cell / 2,
      y: s.oy + c.gy * s.cell + s.cell / 2,
    }));
    // Retune existing tower ranges to current cell size
    for (const tw of s.towers) {
      tw.range = towerRange(s.cell, tw.char);
      tw.dps = towerDps(tw.char);
    }
  };

  const loadLevel = (levelNum: number, keepTowers: boolean) => {
    const s = state.current;
    const def = levelFor(levelNum);
    s.level = levelNum;
    s.levelDef = def;
    s.wavesForLevel = def.waves;
    s.waveInLevel = 0;
    s.spawnLeft = 0;
    s.spawnAcc = 0;
    s.betweenWaves = 2.2;
    s.phase = "build";
    s.enemies = [];
    s.shots = [];
    s.levelBanner = 2.4;
    setLevelUi(levelNum);
    setLevelName(def.name);

    applyLevelPath();

    if (!keepTowers) {
      s.towers = [];
    } else {
      // Remove towers that now sit on path; refund
      const kept: Tower[] = [];
      for (const tw of s.towers) {
        if (s.pathKeys.has(`${tw.gx},${tw.gy}`)) {
          s.energy += TOWER_COST;
        } else {
          kept.push(tw);
        }
      }
      s.towers = kept;
      setEnergy(s.energy);
    }
  };

  const placeTower = (gx: number, gy: number, char: Character, free = false) => {
    const s = state.current;
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return false;
    if (s.pathKeys.has(`${gx},${gy}`)) return false;
    if (s.towers.some((t) => t.gx === gx && t.gy === gy)) return false;
    if (!free && s.energy < TOWER_COST) return false;
    if (!free) {
      s.energy -= TOWER_COST;
      setEnergy(s.energy);
    }
    const tower: Tower = {
      gx,
      gy,
      char,
      range: towerRange(s.cell, char),
      dps: towerDps(char),
      cd: 0,
    };
    loadImage(char.idle).then((img) => {
      tower.img = img;
      s.images.set(char.id, img);
    });
    s.towers.push(tower);
    const idx = CHARACTERS.findIndex((c) => c.id === char.id);
    s.nextChar = CHARACTERS[(idx + 1) % CHARACTERS.length]!;
    return true;
  };

  const start = () => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 360;
    const h = canvas?.clientHeight || 520;
    const s = state.current;
    layoutGrid(w, h);
    s.energy = 75;
    s.core = 14;
    s.score = 0;
    s.time = 0;
    setScore(0);
    setEnergy(75);
    setCore(14);
    s.pilot = getSelectedAgent();
    s.nextChar = s.pilot;
    loadImage(s.pilot.idle).then((img) => {
      s.pilotImg = img;
    });
    loadLevel(1, false);
    // free starter near first safe pad
    const st = s.levelDef.starter;
    if (!placeTower(st.gx, st.gy, s.pilot, true)) {
      // fallback: first free cell
      outer: for (let gy = 0; gy < ROWS; gy++) {
        for (let gx = 0; gx < COLS; gx++) {
          if (placeTower(gx, gy, s.pilot, true)) break outer;
        }
      }
    }
    setStatus("playing");
  };

  const endGame = () => {
    const next = setHighScore("tower", state.current.score);
    setHigh(next);
    setStatus("over");
  };

  const enemyPos = (e: Enemy): Point => {
    const path = state.current.path;
    if (path.length < 2) return { x: 0, y: 0 };
    const max = path.length - 1;
    const t = Math.min(max, Math.max(0, e.t));
    const i = Math.floor(t);
    const f = t - i;
    const a = path[Math.min(i, max)]!;
    const b = path[Math.min(i + 1, max)]!;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };

  const spawnEnemy = (wave: number, level: number) => {
    const roll = Math.random();
    let kind: Enemy["kind"] = "glitch";
    if (wave >= 2 && roll > 0.72) kind = "tank";
    else if (wave >= 1 && roll > 0.4) kind = "swift";
    if (level >= 3 && wave >= 2 && Math.random() > 0.88) kind = "boss";

    const baseHp = 36 + wave * 14 + level * 12;
    const mult =
      kind === "tank" ? 2.4 : kind === "boss" ? 4.5 : kind === "swift" ? 0.75 : 1;
    const speedBase = 0.48 + wave * 0.035 + level * 0.028;
    const speed =
      kind === "swift" ? speedBase * 1.45 : kind === "tank" || kind === "boss" ? speedBase * 0.7 : speedBase;
    const color =
      kind === "boss"
        ? "#c084fc"
        : kind === "tank"
          ? "#ff6b2b"
          : kind === "swift"
            ? "#f5e642"
            : "#3ecbff";
    const hp = baseHp * mult;
    state.current.enemies.push({
      t: 0,
      hp,
      maxHp: hp,
      speed,
      value: Math.round((8 + wave * 2 + level) * (kind === "boss" ? 4 : kind === "tank" ? 2 : 1)),
      color,
      kind,
    });
  };

  useGameLoop(canvasRef, {
    onResize: (api) => {
      layoutGrid(api.width, api.height);
      applyLevelPath();
    },
    update: (dt, api) => {
      const s = state.current;
      s.time += dt;
      s.levelBanner = Math.max(0, s.levelBanner - dt);
      if (statusRef.current !== "playing") return;

      // Level complete when wave quota done and field clear
      if (
        s.phase === "spawn" &&
        s.spawnLeft <= 0 &&
        s.enemies.length === 0 &&
        s.waveInLevel >= s.wavesForLevel
      ) {
        s.score += 60 * s.level;
        setScore(s.score);
        // Small clear bonus — not a full rebuild wallet
        s.energy += 10 + s.level * 2;
        setEnergy(s.energy);
        s.core = Math.min(18, s.core + 1);
        setCore(s.core);
        loadLevel(s.level + 1, true);
        // keep playing — banners show new map
      }

      if (s.spawnLeft <= 0 && s.waveInLevel < s.wavesForLevel) {
        s.betweenWaves -= dt;
        if (s.betweenWaves <= 0) {
          s.waveInLevel += 1;
          s.phase = "spawn";
          const count = 7 + s.waveInLevel * 3 + s.level * 2;
          s.spawnLeft = count;
          s.betweenWaves = 2.6;
          // Tiny income so you can plan — not spam towers every wave
          s.energy += 3;
          setEnergy(s.energy);
        }
      } else if (s.spawnLeft > 0) {
        s.spawnAcc += dt;
        const rate = Math.max(0.28, 0.78 - s.level * 0.04 - s.waveInLevel * 0.03);
        if (s.spawnAcc >= rate) {
          s.spawnAcc = 0;
          s.spawnLeft -= 1;
          spawnEnemy(s.waveInLevel, s.level);
        }
      }

      for (const e of s.enemies) e.t += e.speed * dt;

      for (const e of s.enemies) {
        if (e.t >= s.path.length - 1 && e.hp > 0) {
          e.hp = 0;
          const dmg = e.kind === "boss" ? 3 : e.kind === "tank" ? 2 : 1;
          s.core -= dmg;
          setCore(s.core);
          if (s.core <= 0) endGame();
        }
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);

      for (const tw of s.towers) {
        tw.cd -= dt;
        const tx = s.ox + tw.gx * s.cell + s.cell / 2;
        const ty = s.oy + tw.gy * s.cell + s.cell / 2;
        if (tw.cd > 0) continue;
        let best: Enemy | null = null;
        let bestD = 9999;
        for (const e of s.enemies) {
          const p = enemyPos(e);
          const d = Math.hypot(p.x - tx, p.y - ty);
          if (d <= tw.range && d < bestD) {
            best = e;
            bestD = d;
          }
        }
        if (best) {
          tw.cd = 0.48;
          const p = enemyPos(best);
          best.hp -= tw.dps;
          s.shots.push({
            x: tx,
            y: ty,
            tx: p.x,
            ty: p.y,
            life: 0.14,
            color: tw.char.accent,
          });
          if (best.hp <= 0) {
            s.score += best.value;
            setScore(s.score);
            const gain =
              best.kind === "boss" ? 5 : best.kind === "tank" ? 2 : best.kind === "swift" ? 1 : 1;
            s.energy += gain;
            setEnergy(s.energy);
          }
        }
      }

      for (const sh of s.shots) sh.life -= dt;
      s.shots = s.shots.filter((sh) => sh.life > 0);
    },
    draw: (api) => {
      const { ctx, width, height } = api;
      const s = state.current;
      drawNeonVoid(ctx, width, height, s.time, { grid: false, rails: true });

      for (let gy = 0; gy < ROWS; gy++) {
        for (let gx = 0; gx < COLS; gx++) {
          const x = s.ox + gx * s.cell;
          const y = s.oy + gy * s.cell;
          const onPath = s.pathKeys.has(`${gx},${gy}`);
          ctx.fillStyle = onPath ? "rgba(255,43,214,0.14)" : "rgba(62,203,255,0.07)";
          ctx.strokeStyle = onPath ? "rgba(255,43,214,0.5)" : "rgba(62,203,255,0.28)";
          ctx.lineWidth = 1;
          ctx.fillRect(x + 2, y + 2, s.cell - 4, s.cell - 4);
          ctx.strokeRect(x + 2, y + 2, s.cell - 4, s.cell - 4);
        }
      }

      if (s.path.length > 1) {
        ctx.strokeStyle = "rgba(245,230,66,0.6)";
        ctx.lineWidth = Math.max(3, s.cell * 0.12);
        ctx.lineJoin = "round";
        ctx.shadowColor = "#f5e642";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(s.path[0]!.x, s.path[0]!.y);
        for (let i = 1; i < s.path.length; i++) ctx.lineTo(s.path[i]!.x, s.path[i]!.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // entry / core markers
        const a = s.path[0]!;
        const b = s.path[s.path.length - 1]!;
        ctx.fillStyle = "#3ecbff";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff2bd6";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const tw of s.towers) {
        const x = s.ox + tw.gx * s.cell + s.cell / 2;
        const y = s.oy + tw.gy * s.cell + s.cell / 2;
        ctx.beginPath();
        ctx.strokeStyle = hexToRgba(tw.char.accent, 0.35);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.arc(x, y, tw.range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const img = tw.img || s.images.get(tw.char.id);
        const size = s.cell * 0.7;
        if (img) drawSprite(ctx, img, x - size / 2, y - size / 2, size, size);
        else {
          ctx.fillStyle = tw.char.accent;
          ctx.beginPath();
          ctx.arc(x, y, size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const e of s.enemies) {
        const p = enemyPos(e);
        const r = e.kind === "boss" ? 13 : e.kind === "tank" ? 11 : 8;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(p.x - 12, p.y - r - 8, 24, 4);
        ctx.fillStyle = "#3dff9a";
        ctx.fillRect(p.x - 12, p.y - r - 8, 24 * ratio, 4);
      }

      for (const sh of s.shots) {
        ctx.strokeStyle = sh.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0, sh.life * 7);
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.tx, sh.ty);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (statusRef.current === "playing") {
        ctx.fillStyle = "rgba(5,2,14,0.62)";
        ctx.fillRect(0, 0, width, 38);
        ctx.fillStyle = "#f5e642";
        ctx.font = "700 11px Orbitron, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`LVL ${s.level}`, 10, 16);
        ctx.fillStyle = "#3ecbff";
        ctx.fillText(`W${s.waveInLevel}/${s.wavesForLevel}`, 70, 16);
        ctx.fillStyle = "#f5e642";
        ctx.fillText(`⚡${s.energy}`, 140, 16);
        ctx.fillStyle = "#ff2bd6";
        ctx.fillText(`CORE ${s.core}`, 200, 16);
        ctx.fillStyle = "#9b8fb8";
        ctx.font = "600 10px Orbitron, sans-serif";
        ctx.fillText(`${s.nextChar.name.split(" ")[0]} ${TOWER_COST}⚡`, 270, 16);
        ctx.fillStyle = "rgba(240,238,246,0.75)";
        ctx.font = "600 10px Rajdhani, sans-serif";
        ctx.fillText(s.levelDef.name, 10, 32);

        if (s.levelBanner > 0) {
          ctx.fillStyle = `rgba(8,4,16,${0.55 * Math.min(1, s.levelBanner)})`;
          ctx.fillRect(0, height * 0.35, width, 70);
          ctx.fillStyle = "#f5e642";
          ctx.font = "800 18px Orbitron, sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "#f5e642";
          ctx.shadowBlur = 14;
          ctx.fillText(`LEVEL ${s.level} · ${s.levelDef.name}`, width / 2, height * 0.35 + 32);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#3ecbff";
          ctx.font = "600 12px Rajdhani, sans-serif";
          ctx.fillText(s.levelDef.blurb, width / 2, height * 0.35 + 54);
        }
      }
    },
  });

  const onTap = (clientX: number, clientY: number) => {
    if (statusRef.current === "ready") {
      start();
      return;
    }
    if (statusRef.current !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = state.current;
    const gx = Math.floor((x - s.ox) / s.cell);
    const gy = Math.floor((y - s.oy) / s.cell);
    placeTower(gx, gy, s.nextChar, false);
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
        setEnergy(100);
        setCore(20);
        setLevelUi(1);
        setLevelName(LEVELS[0]!.name);
      }}
      onStart={start}
      hidePlayPilot
      pilotLocationHint="Your character is the first pad. Tap empty pads to place more."
      hint={`Lvl ${levelUi} ${levelName} · ⚡${energy} · Core ${core} · tap pads (${TOWER_COST}⚡)`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => onTap(e.clientX, e.clientY)}
      />
    </GameCanvasShell>
  );
}
