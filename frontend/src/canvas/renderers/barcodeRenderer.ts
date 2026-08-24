import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

import type { BarcodeElement } from "@/types/labelSchema";
import { dotsToPx } from "@/canvas/coordinateMath";

/**
 * Approximate Tier-1 preview only -- not what the printer will actually
 * render from ^BC/^BQ. A real proof comes from the Tier-2 renderer
 * sidecar (Phase 3).
 *
 * QR rendering is async (the `qrcode` package's browser API has no sync
 * entry point), so results are cached by a key derived from the element's
 * own render-affecting fields and `requestRedraw` is called once a first
 * render completes, so the draw effect re-runs and picks up the cache hit.
 */
export function drawBarcode(
  ctx: CanvasRenderingContext2D,
  element: BarcodeElement,
  scale: number,
  qrCache: Map<string, HTMLCanvasElement>,
  requestRedraw: () => void,
) {
  const x = dotsToPx(element.x, scale);
  const y = dotsToPx(element.y, scale);

  if (element.symbology === "code128") {
    const value = element.serialize
      ? `${element.serialize_prefix}${element.serialize_start}${element.serialize_suffix}`
      : element.value;
    if (!value) return;
    const offscreen = document.createElement("canvas");
    try {
      JsBarcode(offscreen, value, {
        format: "CODE128",
        displayValue: element.show_human_readable,
        width: Math.max(scale * element.module_width, 1),
        height: dotsToPx(element.height_dots, scale),
        margin: 0,
      });
      ctx.drawImage(offscreen, x, y, offscreen.width, offscreen.height);
    } catch {
      drawPlaceholder(ctx, x, y, "invalid barcode value");
    }
    return;
  }

  const qrValue = element.serialize
    ? `${element.serialize_prefix}${element.serialize_start}${element.serialize_suffix}`
    : element.value;
  if (!qrValue) return;
  const key = `${qrValue}|${element.qr_magnification}|${element.qr_error_correction}|${Math.round(scale * 100)}`;
  const cached = qrCache.get(key);
  if (cached) {
    ctx.drawImage(cached, x, y, cached.width, cached.height);
    return;
  }

  const offscreen = document.createElement("canvas");
  const pxPerModule = Math.max(Math.round(dotsToPx(element.qr_magnification, scale)), 1);
  QRCode.toCanvas(
    offscreen,
    qrValue,
    { margin: 0, scale: pxPerModule, errorCorrectionLevel: element.qr_error_correction },
    (err) => {
      if (err) return;
      qrCache.set(key, offscreen);
      requestRedraw();
    },
  );
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
  ctx.save();
  ctx.strokeStyle = "#9ca3af";
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, 100, 30);
  ctx.setLineDash([]);
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + 4, y + 4);
  ctx.restore();
}
