import QRCode from "qrcode";

import type { GridQrElement } from "@/types/labelSchema";
import { dotsToPx } from "@/canvas/coordinateMath";

/**
 * Approximate Tier-1 preview only -- not what the printer will actually
 * render from ^BQ. Cell pitch math is kept deliberately in sync with the
 * backend's compile_grid_qr (edge-to-edge tiling, width_dots/cols x
 * height_dots/rows per cell) so the preview matches the printed layout.
 * QR rendering is async, so results are cached and requestRedraw is
 * called once each cell's first render completes -- same pattern as
 * barcodeRenderer.ts's QR branch, just invoked per cell.
 */
export function drawGridQr(
  ctx: CanvasRenderingContext2D,
  element: GridQrElement,
  scale: number,
  qrCache: Map<string, HTMLCanvasElement>,
  requestRedraw: () => void,
) {
  const originX = dotsToPx(element.x, scale);
  const originY = dotsToPx(element.y, scale);
  const colPitch = element.width_dots / element.cols;
  const rowPitch = element.height_dots / element.rows;
  const pxPerModule = Math.max(Math.round(dotsToPx(element.qr_magnification, scale)), 1);

  for (let r = 0; r < element.rows; r++) {
    for (let c = 0; c < element.cols; c++) {
      const n = element.start_number + r * element.cols + c;
      const value = `${element.value_prefix}${String(n).padStart(element.zero_pad_width, "0")}`;
      const dx = originX + dotsToPx(Math.round(c * colPitch), scale);
      const dy = originY + dotsToPx(Math.round(r * rowPitch), scale);

      const key = `${value}|${element.qr_magnification}|${element.qr_error_correction}|${Math.round(scale * 100)}`;
      const cached = qrCache.get(key);
      if (cached) {
        ctx.drawImage(cached, dx, dy, cached.width, cached.height);
        continue;
      }

      const offscreen = document.createElement("canvas");
      QRCode.toCanvas(
        offscreen,
        value,
        { margin: 0, scale: pxPerModule, errorCorrectionLevel: element.qr_error_correction },
        (err) => {
          if (err) return;
          qrCache.set(key, offscreen);
          requestRedraw();
        },
      );
    }
  }
}
