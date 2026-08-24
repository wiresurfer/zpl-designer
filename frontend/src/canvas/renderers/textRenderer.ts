import type { TextElement } from "@/types/labelSchema";
import { dotsToPx } from "@/canvas/coordinateMath";

export function drawText(ctx: CanvasRenderingContext2D, element: TextElement, scale: number) {
  const px = dotsToPx(element.x, scale);
  const py = dotsToPx(element.y, scale);
  const fontPx = dotsToPx(element.font_height_dots, scale);

  const text = element.serialize ? `${element.serialize_start}+` : element.value;

  ctx.save();
  ctx.fillStyle = element.serialize ? "#2563eb" : "#111827";
  ctx.font = `${fontPx}px monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(text, px, py);
  ctx.restore();
}
