import type { Element } from "@/types/labelSchema";

/** Convert dots (the schema's coordinate unit) to on-screen pixels at a given zoom. */
export function dotsToPx(dots: number, scale: number): number {
  return dots * scale;
}

export function pxToDots(px: number, scale: number): number {
  return Math.round(px / scale);
}

/** Rounds a dots value to the nearest multiple of stepDots. */
export function snapToGrid(valueDots: number, stepDots: number): number {
  if (stepDots <= 0) return valueDots;
  return Math.round(valueDots / stepDots) * stepDots;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Approximate on-canvas bounding box for hit-testing/selection display.
 * Only linebox/raw elements carry real width/height in the schema (and
 * only those are resizable); text/barcode bounds here are an estimate
 * used purely for the editor UI, not sent to the compiler.
 */
export function getElementBounds(element: Element): Bounds {
  switch (element.type) {
    case "text": {
      const text = element.serialize ? `${element.serialize_start}+` : element.value;
      const width = Math.max(text.length * element.font_width_dots * 0.65, 10);
      return { x: element.x, y: element.y, width, height: element.font_height_dots };
    }
    case "barcode": {
      if (element.symbology === "qr") {
        const side = element.qr_magnification * 25;
        return { x: element.x, y: element.y, width: side, height: side };
      }
      const barcodeValue = element.serialize
        ? `${element.serialize_prefix}${element.serialize_start}${element.serialize_suffix}`
        : element.value;
      const width = Math.max(barcodeValue.length * element.module_width * 11, 40);
      const height = element.height_dots + (element.show_human_readable ? 24 : 0);
      return { x: element.x, y: element.y, width, height };
    }
    case "linebox":
    case "raw":
    case "grid-qr":
      return {
        x: element.x,
        y: element.y,
        width: Math.max(element.width_dots, 1),
        height: Math.max(element.height_dots, 1),
      };
  }
}

export function isResizable(
  element: Element,
): element is Extract<Element, { type: "linebox" | "raw" | "grid-qr" }> {
  return element.type === "linebox" || element.type === "raw" || element.type === "grid-qr";
}

export type HandlePosition = "nw" | "ne" | "sw" | "se";

export function hitTestHandles(bounds: Bounds, px: number, py: number, scale: number): HandlePosition | null {
  const handleSize = 8;
  const corners: [HandlePosition, number, number][] = [
    ["nw", bounds.x, bounds.y],
    ["ne", bounds.x + bounds.width, bounds.y],
    ["sw", bounds.x, bounds.y + bounds.height],
    ["se", bounds.x + bounds.width, bounds.y + bounds.height],
  ];
  for (const [pos, dx, dy] of corners) {
    const cx = dotsToPx(dx, scale);
    const cy = dotsToPx(dy, scale);
    if (Math.abs(px - cx) <= handleSize && Math.abs(py - cy) <= handleSize) {
      return pos;
    }
  }
  return null;
}

export function hitTestBounds(bounds: Bounds, xDots: number, yDots: number): boolean {
  return xDots >= bounds.x && xDots <= bounds.x + bounds.width && yDots >= bounds.y && yDots <= bounds.y + bounds.height;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function rectsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Ids of every element whose (unrotated, approximate) bounds overlap
 * rectDots -- used for rubber-band marquee selection. Rotated elements
 * are tested against their unrotated bounds, the same approximation
 * getElementBounds already makes elsewhere; acceptable since marquee
 * selection is a coarse gesture, not a precision hit-test.
 */
export function elementsInRect(elements: Element[], rectDots: Bounds): string[] {
  return elements.filter((el) => rectsIntersect(getElementBounds(el), rectDots)).map((el) => el.id);
}

/**
 * Rendering rotates an element around its own origin (its x,y point).
 * Hit-testing therefore needs the inverse: given a raw mouse point in
 * pixels, rotate it backwards around that same origin to find where it
 * would land in the element's own unrotated coordinate space, so it can
 * be compared against the element's (unrotated) bounds.
 */
export function inverseRotatePx(
  px: number,
  py: number,
  originPxX: number,
  originPxY: number,
  degrees: number,
): { x: number; y: number } {
  if (degrees === 0) return { x: px, y: py };
  const rad = (-degrees * Math.PI) / 180;
  const dx = px - originPxX;
  const dy = py - originPxY;
  return {
    x: originPxX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: originPxY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}
