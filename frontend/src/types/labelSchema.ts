export type Rotation = 0 | 90 | 180 | 270;

export interface Canvas {
  width_dots: number;
  height_dots: number;
  dpi: number;
}

export const DEFAULT_CANVAS: Canvas = { width_dots: 609, height_dots: 406, dpi: 203 };

interface ElementBase {
  id: string;
  x: number;
  y: number;
  rotation: Rotation;
}

/** Native ZPL serialization (^SN) -- the printer auto-increments this
 * field on each copy of a multi-quantity (^PQ) print run, instead of the
 * app compiling N separate documents. ^SN's own start value natively
 * preserves prefix/suffix text around the digit run it increments; these
 * are just a friendlier split for the UI, concatenated back into one
 * string by the compiler. Confirmed working for text; Code128 barcode
 * support is implemented but should be print-verified before relying on
 * it (docs are inconsistent). Not available for QR. */
interface SerializationFields {
  serialize: boolean;
  serialize_prefix: string;
  serialize_start: string;
  serialize_suffix: string;
  serialize_step: number;
  serialize_leading_zeros: boolean;
}

export interface TextElement extends ElementBase, SerializationFields {
  type: "text";
  font: string;
  font_height_dots: number;
  font_width_dots: number;
  value: string;
  max_length: number | null;
}

export interface BarcodeElement extends ElementBase, SerializationFields {
  type: "barcode";
  symbology: "code128" | "qr";
  value: string;
  height_dots: number;
  module_width: number;
  show_human_readable: boolean;
  qr_magnification: number;
  qr_error_correction: "L" | "M" | "Q" | "H";
}

export interface LineBoxElement extends ElementBase {
  type: "linebox";
  width_dots: number;
  height_dots: number;
  thickness_dots: number;
  corner_roundness: number;
  style: "solid" | "dashed" | "dotted";
  dash_dots: number;
  gap_dots: number;
}

export interface RawElement extends ElementBase {
  type: "raw";
  width_dots: number;
  height_dots: number;
  zpl_snippet: string;
  label: string;
}

export interface GridQrElement extends ElementBase {
  type: "grid-qr";
  width_dots: number;
  height_dots: number;
  rows: number;
  cols: number;
  value_prefix: string;
  start_number: number;
  zero_pad_width: number;
  qr_magnification: number;
  qr_error_correction: "L" | "M" | "Q" | "H";
}

export type Element = TextElement | BarcodeElement | LineBoxElement | RawElement | GridQrElement;
export type ElementType = Element["type"];

/** Partial<Element> only allows fields shared by every element type (keyof
 * a union is the intersection of its members' keys). This distributes
 * Partial over each member instead, so a patch can carry any subset of
 * that specific element type's own fields. */
export type ElementPatch = Element extends infer E ? Partial<E> : never;

export interface LabelDoc {
  id: string;
  name: string;
  canvas: Canvas;
  elements: Element[];
}

function uuid(): string {
  return crypto.randomUUID();
}

export function newLabelDoc(name = "Untitled Label"): LabelDoc {
  return { id: uuid(), name, canvas: { ...DEFAULT_CANVAS }, elements: [] };
}

export type LineBoxPreset = "line" | "box";

const DEFAULT_SERIALIZATION: SerializationFields = {
  serialize: false,
  serialize_prefix: "",
  serialize_start: "1",
  serialize_suffix: "",
  serialize_step: 1,
  serialize_leading_zeros: false,
};

export function newElement(type: ElementType, x: number, y: number, preset?: LineBoxPreset): Element {
  const base = { id: uuid(), x, y, rotation: 0 as Rotation };
  switch (type) {
    case "text":
      return {
        ...base,
        type: "text",
        font: "0",
        font_height_dots: 30,
        font_width_dots: 30,
        value: "Text",
        max_length: null,
        ...DEFAULT_SERIALIZATION,
      };
    case "barcode":
      return {
        ...base,
        type: "barcode",
        symbology: "code128",
        value: "123456789",
        height_dots: 80,
        module_width: 2,
        show_human_readable: true,
        qr_magnification: 4,
        qr_error_correction: "M",
        ...DEFAULT_SERIALIZATION,
      };
    case "linebox":
      return preset === "box"
        ? {
            ...base,
            type: "linebox",
            width_dots: 150,
            height_dots: 100,
            thickness_dots: 2,
            corner_roundness: 0,
            style: "solid",
            dash_dots: 20,
            gap_dots: 10,
          }
        : {
            ...base,
            type: "linebox",
            width_dots: 200,
            height_dots: 2,
            thickness_dots: 2,
            corner_roundness: 0,
            style: "solid",
            dash_dots: 20,
            gap_dots: 10,
          };
    case "raw":
      return {
        ...base,
        type: "raw",
        width_dots: 100,
        height_dots: 40,
        zpl_snippet: "^FO0,0^GB100,40,2^FS",
        label: "Custom ZPL",
      };
    case "grid-qr":
      return {
        ...base,
        type: "grid-qr",
        width_dots: 200,
        height_dots: 100,
        rows: 2,
        cols: 5,
        value_prefix: "",
        start_number: 1,
        zero_pad_width: 2,
        qr_magnification: 3,
        qr_error_correction: "M",
      };
  }
}
