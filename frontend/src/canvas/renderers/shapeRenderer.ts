import type { LineBoxElement } from "@/types/labelSchema";
import { dotsToPx } from "@/canvas/coordinateMath";

export function drawLineBox(ctx: CanvasRenderingContext2D, element: LineBoxElement, scale: number) {
  const x = dotsToPx(element.x, scale);
  const y = dotsToPx(element.y, scale);
  const width = dotsToPx(Math.max(element.width_dots, 1), scale);
  const height = dotsToPx(Math.max(element.height_dots, 1), scale);
  const thickness = Math.max(dotsToPx(element.thickness_dots, scale), 1);
  const radius = dotsToPx(element.corner_roundness, scale);

  ctx.save();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = thickness;
  if (element.style !== "solid") {
    ctx.setLineDash([dotsToPx(element.dash_dots, scale), dotsToPx(element.gap_dots, scale)]);
  }
  ctx.beginPath();
  if (radius > 0 && ctx.roundRect) {
    ctx.roundRect(x + thickness / 2, y + thickness / 2, width - thickness, height - thickness, radius);
  } else {
    ctx.rect(x + thickness / 2, y + thickness / 2, width - thickness, height - thickness);
  }
  ctx.stroke();
  ctx.restore();
}
