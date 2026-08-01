import { useEffect, useRef } from "react";

export type GameLoopApi = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
};

type LoopHandlers = {
  update: (dt: number, api: GameLoopApi) => void;
  draw: (api: GameLoopApi) => void;
  onResize?: (api: GameLoopApi) => void;
};

/**
 * Fixed-feel RAF loop with capped delta. Canvas is sized to CSS box * dpr.
 */
export function useGameLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  handlers: LoopHandlers,
  active = true,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let running = true;

    const size = () => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth || canvas.clientWidth || 360;
      const cssH = parent?.clientHeight || canvas.clientHeight || 520;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const api: GameLoopApi = { canvas, ctx, width: cssW, height: cssH, dpr };
      handlersRef.current.onResize?.(api);
    };

    size();
    const ro = new ResizeObserver(size);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const frame = (now: number) => {
      if (!running) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      const cssW = canvas.clientWidth || 360;
      const cssH = canvas.clientHeight || 520;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const api: GameLoopApi = { canvas, ctx, width: cssW, height: cssH, dpr };
      handlersRef.current.update(dt, api);
      handlersRef.current.draw(api);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [canvasRef, active]);
}
