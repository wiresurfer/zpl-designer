import type { RawElement } from "@/types/labelSchema";
import { dotsToPx } from "@/canvas/coordinateMath";

/** Arbitrary ZPL can't be rendered in-canvas -- show a labeled placeholder. */
export function drawRaw(ctx: CanvasRenderingContext2D, element: RawElement, scale: number) {
  const x = dotsToPx(element.x, scale);
  const y = dotsToPx(element.y, scale);
  const width = dotsToPx(Math.max(element.width_dots, 1), scale);
  const height = dotsToPx(Math.max(element.height_dots, 1), scale);

  ctx.save();
  ctx.strokeStyle = "#a855f7";
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#a855f7";
  ctx.font = "11px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(element.label || "Custom ZPL", x + 4, y + 4);
  ctx.restore();
}
