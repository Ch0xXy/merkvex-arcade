/** Shared neon cabinet backdrop helpers (breakout-style juice). */

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(62,203,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawNeonVoid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  opts?: { grid?: boolean; rails?: boolean },
) {
  const grid = opts?.grid !== false;
  const rails = opts?.rails !== false;

  const bg = ctx.createLinearGradient(0, 0, width * 0.15, height);
  bg.addColorStop(0, "#22063a");
  bg.addColorStop(0.45, "#0e0520");
  bg.addColorStop(1, "#05020e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const w1 = ctx.createRadialGradient(
    width * 0.2,
    height * 0.15,
    8,
    width * 0.2,
    height * 0.15,
    width * 0.5,
  );
  w1.addColorStop(0, "rgba(255,43,214,0.14)");
  w1.addColorStop(1, "transparent");
  ctx.fillStyle = w1;
  ctx.fillRect(0, 0, width, height);

  const w2 = ctx.createRadialGradient(
    width * 0.82,
    height * 0.18,
    8,
    width * 0.82,
    height * 0.18,
    width * 0.48,
  );
  w2.addColorStop(0, "rgba(62,203,255,0.12)");
  w2.addColorStop(1, "transparent");
  ctx.fillStyle = w2;
  ctx.fillRect(0, 0, width, height);

  const w3 = ctx.createRadialGradient(
    width * 0.5,
    height * 0.4,
    6,
    width * 0.5,
    height * 0.4,
    width * 0.4,
  );
  w3.addColorStop(0, "rgba(124,92,255,0.08)");
  w3.addColorStop(1, "transparent");
  ctx.fillStyle = w3;
  ctx.fillRect(0, 0, width, height);

  if (grid) {
    const gridY = height * 0.58;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, gridY, width, height - gridY);
    ctx.clip();
    const scroll = (time * 42) % 32;
    for (let i = -2; i < 18; i++) {
      const y = gridY + i * 32 + scroll;
      ctx.strokeStyle = `rgba(62,203,255,${0.05 + (i / 18) * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const vx = width / 2;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(vx, gridY - 30);
      ctx.lineTo(vx + i * width * 0.11, height + 20);
      ctx.strokeStyle =
        i === 0 ? "rgba(245,230,66,0.14)" : i % 2 === 0 ? "rgba(255,43,214,0.1)" : "rgba(124,92,255,0.08)";
      ctx.stroke();
    }
    ctx.restore();
  }

  if (rails) {
    const railPulse = 0.35 + 0.25 * Math.sin(time * 3);
    for (const side of [0, 1] as const) {
      const x = side === 0 ? 0 : width - 3;
      const rg = ctx.createLinearGradient(0, 0, 0, height);
      rg.addColorStop(0, hexToRgba("#ff2bd6", railPulse));
      rg.addColorStop(0.5, hexToRgba("#3ecbff", railPulse + 0.12));
      rg.addColorStop(1, hexToRgba("#f5e642", railPulse));
      ctx.fillStyle = rg;
      ctx.shadowColor = side === 0 ? "#ff2bd6" : "#3ecbff";
      ctx.shadowBlur = 12;
      ctx.fillRect(x, 0, 3, height);
      ctx.shadowBlur = 0;
    }
  }
}
