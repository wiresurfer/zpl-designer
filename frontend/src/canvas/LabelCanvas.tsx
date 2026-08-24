import { useEffect, useRef, useState } from "react";

import { drawBarcode } from "@/canvas/renderers/barcodeRenderer";
import { drawGridQr } from "@/canvas/renderers/gridQrRenderer";
import { drawRaw } from "@/canvas/renderers/rawSnippetRenderer";
import { drawLineBox } from "@/canvas/renderers/shapeRenderer";
import { drawText } from "@/canvas/renderers/textRenderer";
import {
  clamp,
  dotsToPx,
  elementsInRect,
  getElementBounds,
  hitTestBounds,
  hitTestHandles,
  inverseRotatePx,
  isResizable,
  pxToDots,
  snapToGrid,
  type HandlePosition,
} from "@/canvas/coordinateMath";
import { useLabelStore } from "@/state/labelStore";
import type { Element, ElementPatch, ElementType } from "@/types/labelSchema";

const PLACE_MIN_SIZE_DOTS = 40;

type DragMode =
  | {
      kind: "move";
      ids: string[];
      startPx: { x: number; y: number };
      startPositions: Record<string, { x: number; y: number }>;
    }
  | {
      kind: "resize";
      id: string;
      handle: HandlePosition;
      originPx: { x: number; y: number };
      rotation: number;
      startLocalPx: { x: number; y: number };
      start: { x: number; y: number; width: number; height: number };
    }
  | { kind: "marquee"; startDots: { x: number; y: number }; currentDots: { x: number; y: number } }
  | { kind: "place-rect"; type: ElementType; startDots: { x: number; y: number }; currentDots: { x: number; y: number } };

export default function LabelCanvas() {
  const {
    doc,
    selectedIds,
    select,
    toggleSelect,
    selectMany,
    clearSelection,
    updateElement,
    duplicateSelection,
    gridConfig,
    setGridConfig,
    armedTool,
    setArmedTool,
    addElementAt,
  } = useLabelStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.3);
  const dragRef = useRef<DragMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const qrCacheRef = useRef(new Map<string, HTMLCanvasElement>());
  const [redrawVersion, setRedrawVersion] = useState(0);
  const [dragTick, setDragTick] = useState(0);

  const widthPx = dotsToPx(doc.canvas.width_dots, scale);
  const heightPx = dotsToPx(doc.canvas.height_dots, scale);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, duplicateSelection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = widthPx;
    canvas.height = heightPx;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);

    if (gridConfig.visible) {
      drawGrid(ctx, doc.canvas.width_dots, doc.canvas.height_dots, gridConfig.colSpacingDots, gridConfig.rowSpacingDots, scale);
    }

    const requestRedraw = () => setRedrawVersion((v) => v + 1);
    for (const element of doc.elements) {
      drawElement(ctx, element, scale, qrCacheRef.current, requestRedraw);
    }

    for (const el of doc.elements) {
      if (selectedIds.includes(el.id)) {
        drawSelection(ctx, el, scale, selectedIds.length === 1);
      }
    }

    const drag = dragRef.current;
    if (drag?.kind === "marquee") {
      drawPreviewRect(ctx, drag.startDots, drag.currentDots, scale, "#3b82f6");
    } else if (drag?.kind === "place-rect") {
      drawPreviewRect(ctx, drag.startDots, drag.currentDots, scale, "#16a34a");
    }
  }, [doc, selectedIds, scale, widthPx, heightPx, redrawVersion, gridConfig, dragTick]);

  /** Raw mouse point (px), rotated backwards around an element's own
   * origin so it can be compared against that element's unrotated bounds. */
  function toLocalPoint(el: Element, px: number, py: number) {
    const originPx = dotsToPx(el.x, scale);
    const originPy = dotsToPx(el.y, scale);
    return inverseRotatePx(px, py, originPx, originPy, el.rotation);
  }

  function elementAtPoint(px: number, py: number): Element | null {
    for (let i = doc.elements.length - 1; i >= 0; i--) {
      const el = doc.elements[i];
      const local = toLocalPoint(el, px, py);
      const xDots = pxToDots(local.x, scale);
      const yDots = pxToDots(local.y, scale);
      if (hitTestBounds(getElementBounds(el), xDots, yDots)) return el;
    }
    return null;
  }

  function pointToDots(px: number, py: number) {
    return { x: pxToDots(px, scale), y: pxToDots(py, scale) };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (armedTool) {
      dragRef.current = { kind: "place-rect", type: armedTool, startDots: pointToDots(px, py), currentDots: pointToDots(px, py) };
      setDragTick((v) => v + 1);
      return;
    }

    if (selectedIds.length === 1) {
      const selected = doc.elements.find((el) => el.id === selectedIds[0]);
      if (selected && isResizable(selected)) {
        const bounds = getElementBounds(selected);
        const local = toLocalPoint(selected, px, py);
        const handle = hitTestHandles(bounds, local.x, local.y, scale);
        if (handle) {
          dragRef.current = {
            kind: "resize",
            id: selected.id,
            handle,
            originPx: { x: dotsToPx(selected.x, scale), y: dotsToPx(selected.y, scale) },
            rotation: selected.rotation,
            startLocalPx: local,
            start: { x: selected.x, y: selected.y, width: selected.width_dots, height: selected.height_dots },
          };
          return;
        }
      }
    }

    const hit = elementAtPoint(px, py);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (hit) {
      if (additive) {
        toggleSelect(hit.id);
        return;
      }
      const ids = selectedIds.includes(hit.id) && selectedIds.length > 1 ? selectedIds : [hit.id];
      if (!(selectedIds.includes(hit.id) && selectedIds.length > 1)) {
        select(hit.id);
      }
      const startPositions: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const el = doc.elements.find((e2) => e2.id === id);
        if (el) startPositions[id] = { x: el.x, y: el.y };
      }
      dragRef.current = { kind: "move", ids, startPx: { x: px, y: py }, startPositions };
      return;
    }

    if (additive) return; // shift/cmd-click on empty space: no-op, keep selection
    dragRef.current = { kind: "marquee", startDots: pointToDots(px, py), currentDots: pointToDots(px, py) };
    setDragTick((v) => v + 1);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (drag.kind === "marquee" || drag.kind === "place-rect") {
      dragRef.current = { ...drag, currentDots: pointToDots(px, py) };
      setDragTick((v) => v + 1);
      return;
    }

    if (drag.kind === "move") {
      const rawDxDots = pxToDots(px - drag.startPx.x, scale);
      const rawDyDots = pxToDots(py - drag.startPx.y, scale);
      const dxDots = gridConfig.snapEnabled ? snapToGrid(rawDxDots, gridConfig.colSpacingDots) : rawDxDots;
      const dyDots = gridConfig.snapEnabled ? snapToGrid(rawDyDots, gridConfig.rowSpacingDots) : rawDyDots;
      for (const id of drag.ids) {
        const start = drag.startPositions[id];
        if (!start) continue;
        const x = clamp(start.x + dxDots, 0, doc.canvas.width_dots - 1);
        const y = clamp(start.y + dyDots, 0, doc.canvas.height_dots - 1);
        updateElement(id, { x, y });
      }
      return;
    }

    // resize -- rotate the current point backwards around the element's
    // origin (same as at drag-start) so deltas are measured in the
    // element's own unrotated local space, not screen space.
    const local = inverseRotatePx(px, py, drag.originPx.x, drag.originPx.y, drag.rotation);
    const dxDots = pxToDots(local.x - drag.startLocalPx.x, scale);
    const dyDots = pxToDots(local.y - drag.startLocalPx.y, scale);
    const { x: startX, y: startY, width: startW, height: startH } = drag.start;
    const minSize = 4;

    let x = startX;
    let y = startY;
    let width = startW;
    let height = startH;

    if (drag.handle.includes("w")) {
      x = clamp(startX + dxDots, 0, startX + startW - minSize);
      width = startW - (x - startX);
    } else {
      width = Math.max(startW + dxDots, minSize);
    }
    if (drag.handle.includes("n")) {
      y = clamp(startY + dyDots, 0, startY + startH - minSize);
      height = startH - (y - startY);
    } else {
      height = Math.max(startH + dyDots, minSize);
    }

    updateElement(drag.id, { x, y, width_dots: width, height_dots: height } as ElementPatch);
  }

  function handleMouseUp() {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.kind === "marquee") {
      const { startDots, currentDots } = drag;
      const dragPx = Math.abs(dotsToPx(currentDots.x - startDots.x, scale));
      const dragPy = Math.abs(dotsToPx(currentDots.y - startDots.y, scale));
      if (dragPx < 3 && dragPy < 3) {
        clearSelection();
      } else {
        const rectDots = {
          x: Math.min(startDots.x, currentDots.x),
          y: Math.min(startDots.y, currentDots.y),
          width: Math.abs(currentDots.x - startDots.x),
          height: Math.abs(currentDots.y - startDots.y),
        };
        selectMany(elementsInRect(doc.elements, rectDots));
      }
      setDragTick((v) => v + 1);
      return;
    }

    if (drag?.kind === "place-rect") {
      const { startDots, currentDots, type } = drag;
      const x = Math.min(startDots.x, currentDots.x);
      const y = Math.min(startDots.y, currentDots.y);
      const width_dots = Math.max(Math.abs(currentDots.x - startDots.x), PLACE_MIN_SIZE_DOTS);
      const height_dots = Math.max(Math.abs(currentDots.y - startDots.y), PLACE_MIN_SIZE_DOTS);
      addElementAt(type, x, y, { width_dots, height_dots } as ElementPatch);
      setArmedTool(null);
      setDragTick((v) => v + 1);
    }
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit = elementAtPoint(e.clientX - rect.left, e.clientY - rect.top);
    if (hit && hit.type === "text" && !hit.serialize) {
      select(hit.id);
      setEditingId(hit.id);
    }
  }

  const editingElement = doc.elements.find((el) => el.id === editingId && el.type === "text");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Zoom</span>
        <input
          type="range"
          min={0.6}
          max={2.5}
          step={0.1}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        />
        <span>{Math.round(scale * 100)}%</span>
        <span className="ml-4">
          {doc.canvas.width_dots}×{doc.canvas.height_dots} dots ({doc.canvas.dpi} dpi)
        </span>
        <span className="ml-4 text-xs">
          Double-click text to edit &middot; Ctrl/Cmd+D to duplicate &middot; Shift/Cmd-click or drag to multi-select
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={gridConfig.visible}
              onChange={(e) => setGridConfig({ visible: e.target.checked })}
            />
            Grid
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={gridConfig.snapEnabled}
              onChange={(e) => setGridConfig({ snapEnabled: e.target.checked })}
            />
            Snap
          </label>
          <label className="flex items-center gap-1">
            Cols
            <input
              type="number"
              min={1}
              className="w-12 rounded border border-input bg-transparent px-1"
              value={gridConfig.colSpacingDots}
              onChange={(e) => setGridConfig({ colSpacingDots: Math.max(Number(e.target.value), 1) })}
            />
          </label>
          <label className="flex items-center gap-1">
            Rows
            <input
              type="number"
              min={1}
              className="w-12 rounded border border-input bg-transparent px-1"
              value={gridConfig.rowSpacingDots}
              onChange={(e) => setGridConfig({ rowSpacingDots: Math.max(Number(e.target.value), 1) })}
            />
          </label>
        </span>
      </div>
      <div className="relative w-fit">
        <canvas
          ref={canvasRef}
          className={armedTool ? "cursor-crosshair border border-border shadow-sm" : "cursor-default border border-border shadow-sm"}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
        {editingElement && editingElement.type === "text" && (
          <input
            autoFocus
            value={editingElement.value}
            onChange={(e) => updateElement(editingElement.id, { value: e.target.value })}
            onBlur={() => setEditingId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            className="absolute border border-blue-500 bg-white px-0.5 outline-none"
            style={{
              left: dotsToPx(editingElement.x, scale),
              top: dotsToPx(editingElement.y, scale),
              fontSize: dotsToPx(editingElement.font_height_dots, scale),
              lineHeight: 1,
              minWidth: 40,
            }}
          />
        )}
      </div>
    </div>
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  widthDots: number,
  heightDots: number,
  colSpacingDots: number,
  rowSpacingDots: number,
  scale: number,
) {
  ctx.save();
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let x = 0; x <= widthDots; x += colSpacingDots) {
    const px = dotsToPx(x, scale);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, dotsToPx(heightDots, scale));
    ctx.stroke();
  }
  for (let y = 0; y <= heightDots; y += rowSpacingDots) {
    const py = dotsToPx(y, scale);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(dotsToPx(widthDots, scale), py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPreviewRect(
  ctx: CanvasRenderingContext2D,
  startDots: { x: number; y: number },
  currentDots: { x: number; y: number },
  scale: number,
  color: string,
) {
  const x = dotsToPx(Math.min(startDots.x, currentDots.x), scale);
  const y = dotsToPx(Math.min(startDots.y, currentDots.y), scale);
  const width = dotsToPx(Math.abs(currentDots.x - startDots.x), scale);
  const height = dotsToPx(Math.abs(currentDots.y - startDots.y), scale);
  ctx.save();
  ctx.fillStyle = `${color}22`;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function withRotation(ctx: CanvasRenderingContext2D, element: Element, scale: number, draw: () => void) {
  if (element.rotation === 0) {
    draw();
    return;
  }
  const px = dotsToPx(element.x, scale);
  const py = dotsToPx(element.y, scale);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((element.rotation * Math.PI) / 180);
  ctx.translate(-px, -py);
  draw();
  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  element: Element,
  scale: number,
  qrCache: Map<string, HTMLCanvasElement>,
  requestRedraw: () => void,
) {
  switch (element.type) {
    case "text":
      return withRotation(ctx, element, scale, () => drawText(ctx, element, scale));
    case "barcode":
      return withRotation(ctx, element, scale, () => drawBarcode(ctx, element, scale, qrCache, requestRedraw));
    case "linebox":
      return withRotation(ctx, element, scale, () => drawLineBox(ctx, element, scale));
    case "raw":
      return withRotation(ctx, element, scale, () => drawRaw(ctx, element, scale));
    case "grid-qr":
      return withRotation(ctx, element, scale, () => drawGridQr(ctx, element, scale, qrCache, requestRedraw));
  }
}

function drawSelection(ctx: CanvasRenderingContext2D, element: Element, scale: number, showHandles: boolean) {
  withRotation(ctx, element, scale, () => drawSelectionOutline(ctx, element, scale, showHandles));
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, element: Element, scale: number, showHandles: boolean) {
  const bounds = getElementBounds(element);
  const x = dotsToPx(bounds.x, scale);
  const y = dotsToPx(bounds.y, scale);
  const width = dotsToPx(bounds.width, scale);
  const height = dotsToPx(bounds.height, scale);

  ctx.save();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);

  if (showHandles && isResizable(element)) {
    ctx.fillStyle = "#3b82f6";
    for (const [hx, hy] of [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ]) {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }
  }
  ctx.restore();
}
