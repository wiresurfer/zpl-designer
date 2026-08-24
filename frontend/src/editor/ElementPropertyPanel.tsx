import { Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLabelStore } from "@/state/labelStore";
import type { BarcodeElement, ElementPatch, Rotation, TextElement } from "@/types/labelSchema";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Shared serialization (^SN) controls for text and Code128 barcode
 * elements -- see SerializationFields in types/labelSchema.ts. */
function SerializationEditor({
  el,
  set,
}: {
  el: TextElement | BarcodeElement;
  set: (patch: ElementPatch) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={el.serialize} onChange={(e) => set({ serialize: e.target.checked })} />
        Auto-increment across print quantity (^SN)
      </label>
      {el.serialize && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prefix">
              <Input value={el.serialize_prefix} onChange={(e) => set({ serialize_prefix: e.target.value })} />
            </Field>
            <Field label="Start value">
              <Input value={el.serialize_start} onChange={(e) => set({ serialize_start: e.target.value })} />
            </Field>
            <Field label="Suffix">
              <Input value={el.serialize_suffix} onChange={(e) => set({ serialize_suffix: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            e.g. prefix "ARM-SRG-" + start "0001" -&gt; ARM-SRG-0001, ARM-SRG-0002, ...
          </p>
          <Field label="Step">
            <Input
              type="number"
              value={el.serialize_step}
              onChange={(e) => set({ serialize_step: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={el.serialize_leading_zeros}
              onChange={(e) => set({ serialize_leading_zeros: e.target.checked })}
            />
            Preserve leading zeros
          </label>
          <p className="text-xs text-muted-foreground">
            Set a print quantity above 1 in the toolbar for this to increment across copies.
          </p>
        </>
      )}
    </>
  );
}

export default function ElementPropertyPanel() {
  const {
    selectedElement,
    selectedElements,
    updateElement,
    deleteElement,
    duplicateElement,
    duplicateSelection,
    deleteSelection,
  } = useLabelStore();

  if (selectedElements.length === 0) {
    return <p className="text-sm text-muted-foreground">Select an element to edit its properties.</p>;
  }

  if (selectedElements.length > 1) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">{selectedElements.length} elements selected</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={duplicateSelection}>
            <Copy className="h-4 w-4" />
            Duplicate group
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={deleteSelection}>
            <Trash2 className="h-4 w-4" />
            Delete all
          </Button>
        </div>
      </div>
    );
  }

  const el = selectedElement!;
  const set = (patch: ElementPatch) => updateElement(el.id, patch);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">{el.type}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Duplicate (Ctrl/Cmd+D)" onClick={() => duplicateElement(el.id)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteElement(el.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (dots)">
          <Input
            type="number"
            value={el.x}
            onChange={(e) => set({ x: Number(e.target.value) })}
          />
        </Field>
        <Field label="Y (dots)">
          <Input
            type="number"
            value={el.y}
            onChange={(e) => set({ y: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Rotation">
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={el.rotation}
          onChange={(e) => set({ rotation: Number(e.target.value) as Rotation })}
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </Field>

      {el.type === "text" && (
        <>
          {!el.serialize && (
            <Field label="Value">
              <Input value={el.value} onChange={(e) => set({ value: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Font height (dots)">
              <Input
                type="number"
                value={el.font_height_dots}
                onChange={(e) => set({ font_height_dots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Font width (dots)">
              <Input
                type="number"
                value={el.font_width_dots}
                onChange={(e) => set({ font_width_dots: Number(e.target.value) })}
              />
            </Field>
          </div>
          <SerializationEditor el={el} set={set} />
        </>
      )}

      {el.type === "barcode" && (
        <>
          <Field label="Symbology">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={el.symbology}
              onChange={(e) => set({ symbology: e.target.value as "code128" | "qr" })}
            >
              <option value="code128">Code 128</option>
              <option value="qr">QR</option>
            </select>
          </Field>
          {!el.serialize && (
            <Field label="Value">
              <Input value={el.value} onChange={(e) => set({ value: e.target.value })} />
            </Field>
          )}
          {el.symbology === "code128" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Height (dots)">
                <Input
                  type="number"
                  value={el.height_dots}
                  onChange={(e) => set({ height_dots: Number(e.target.value) })}
                />
              </Field>
              <Field label="Module width">
                <Input
                  type="number"
                  value={el.module_width}
                  onChange={(e) => set({ module_width: Number(e.target.value) })}
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Magnification">
                <Input
                  type="number"
                  value={el.qr_magnification}
                  onChange={(e) => set({ qr_magnification: Number(e.target.value) })}
                />
              </Field>
              <Field label="Error correction">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={el.qr_error_correction}
                  onChange={(e) => set({ qr_error_correction: e.target.value as "L" | "M" | "Q" | "H" })}
                >
                  <option value="L">L</option>
                  <option value="M">M</option>
                  <option value="Q">Q</option>
                  <option value="H">H</option>
                </select>
              </Field>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={el.show_human_readable}
              onChange={(e) => set({ show_human_readable: e.target.checked })}
            />
            Show human-readable text
          </label>
          <SerializationEditor el={el} set={set} />
          {el.symbology === "qr" && el.serialize && (
            <p className="text-xs text-muted-foreground">
              QR auto-increment is implemented but not yet print-verified -- scan a test print to confirm.
            </p>
          )}
        </>
      )}

      {el.type === "linebox" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (dots)">
              <Input
                type="number"
                value={el.width_dots}
                onChange={(e) => set({ width_dots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Height (dots)">
              <Input
                type="number"
                value={el.height_dots}
                onChange={(e) => set({ height_dots: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Thickness (dots)">
              <Input
                type="number"
                value={el.thickness_dots}
                onChange={(e) => set({ thickness_dots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Corner roundness">
              <Input
                type="number"
                min={0}
                max={8}
                value={el.corner_roundness}
                onChange={(e) => set({ corner_roundness: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Style">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={el.style}
              onChange={(e) => {
                const style = e.target.value as "solid" | "dashed" | "dotted";
                if (style === "dotted") {
                  set({ style, dash_dots: el.thickness_dots, gap_dots: Math.max(el.thickness_dots * 2, 4) });
                } else if (style === "dashed") {
                  set({ style, dash_dots: 20, gap_dots: 10 });
                } else {
                  set({ style });
                }
              }}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </Field>
          {el.style !== "solid" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dash length (dots)">
                <Input
                  type="number"
                  min={1}
                  value={el.dash_dots}
                  onChange={(e) => set({ dash_dots: Number(e.target.value) })}
                />
              </Field>
              <Field label="Gap length (dots)">
                <Input
                  type="number"
                  min={0}
                  value={el.gap_dots}
                  onChange={(e) => set({ gap_dots: Number(e.target.value) })}
                />
              </Field>
            </div>
          )}
          {el.width_dots > el.thickness_dots * 1.5 && el.height_dots > el.thickness_dots * 1.5 && el.style !== "solid" && (
            <p className="text-xs text-muted-foreground">
              Dashing only follows the longer side for box-shaped elements, not a full dashed border.
            </p>
          )}
        </>
      )}

      {el.type === "grid-qr" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (dots)">
              <Input
                type="number"
                value={el.width_dots}
                onChange={(e) => set({ width_dots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Height (dots)">
              <Input
                type="number"
                value={el.height_dots}
                onChange={(e) => set({ height_dots: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rows">
              <Input
                type="number"
                min={1}
                value={el.rows}
                onChange={(e) => set({ rows: Math.max(Number(e.target.value), 1) })}
              />
            </Field>
            <Field label="Columns">
              <Input
                type="number"
                min={1}
                value={el.cols}
                onChange={(e) => set({ cols: Math.max(Number(e.target.value), 1) })}
              />
            </Field>
          </div>
          <Field label="Value prefix">
            <Input value={el.value_prefix} onChange={(e) => set({ value_prefix: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start number">
              <Input
                type="number"
                value={el.start_number}
                onChange={(e) => set({ start_number: Number(e.target.value) })}
              />
            </Field>
            <Field label="Zero-pad width">
              <Input
                type="number"
                min={0}
                value={el.zero_pad_width}
                onChange={(e) => set({ zero_pad_width: Math.max(Number(e.target.value), 0) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Magnification">
              <Input
                type="number"
                value={el.qr_magnification}
                onChange={(e) => set({ qr_magnification: Number(e.target.value) })}
              />
            </Field>
            <Field label="Error correction">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={el.qr_error_correction}
                onChange={(e) => set({ qr_error_correction: e.target.value as "L" | "M" | "Q" | "H" })}
              >
                <option value="L">L</option>
                <option value="M">M</option>
                <option value="Q">Q</option>
                <option value="H">H</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Codes: {el.value_prefix}
            {String(el.start_number).padStart(el.zero_pad_width, "0")} .. {el.value_prefix}
            {String(el.start_number + el.rows * el.cols - 1).padStart(el.zero_pad_width, "0")}
          </p>
        </>
      )}

      {el.type === "raw" && (
        <>
          <Field label="Editor label">
            <Input value={el.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (dots)">
              <Input
                type="number"
                value={el.width_dots}
                onChange={(e) => set({ width_dots: Number(e.target.value) })}
              />
            </Field>
            <Field label="Height (dots)">
              <Input
                type="number"
                value={el.height_dots}
                onChange={(e) => set({ height_dots: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="ZPL (0,0-relative -- do not use your own ^LH/^FW)">
            <textarea
              className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              value={el.zpl_snippet}
              onChange={(e) => set({ zpl_snippet: e.target.value })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
