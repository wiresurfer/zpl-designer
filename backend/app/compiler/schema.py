"""Pydantic models for the label document schema.

A LabelDoc is the source of truth for a label design: canvas dimensions plus
an ordered list of typed elements. Paint/compile order follows list order.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union
from uuid import uuid4

from pydantic import BaseModel, Field

Rotation = Literal[0, 90, 180, 270]

# ZPL's own orientation convention (N/R/I/B), used by ^A and ^B* commands.
# ^GB has no orientation parameter at all -- ^FW cannot rotate a box/line,
# confirmed against Zebra's own docs. See compiler/elements/shape.py.
ROTATION_CODES: dict[Rotation, str] = {0: "N", 90: "R", 180: "I", 270: "B"}


class Canvas(BaseModel):
    width_dots: int = 609
    height_dots: int = 406
    dpi: int = 203


class ElementBase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    x: int
    y: int
    rotation: Rotation = 0


class SerializationFields(BaseModel):
    """Native ZPL serialization (^SN): when enabled, the printer itself
    auto-increments this field on each copy of a ^PQ multi-quantity print
    run -- one CUPS job prints N labels instead of the app compiling N
    separate documents. ^SN's own start value natively preserves any
    leading/trailing non-digit text around the incrementing run (scans
    right-to-left for up to 12 trailing digits) -- prefix/suffix here are
    just a friendlier split of that one string for the property panel;
    the compiler concatenates them back into ^SN's v parameter.

    Confirmed on real hardware for text fields (^A) and Code128 barcodes
    (^BC), including with an alphanumeric prefix -- ^SN found and
    incremented the trailing digit run, preserved the prefix, and the
    printed barcode scanned correctly. QR (^BQ) support is implemented the
    same way (QR's ^FD content has its own mode-indicator prefix, e.g.
    "MA,", which is just prepended as more fixed text ahead of the
    incrementing digits) but is not yet physically verified -- confirm a
    printed/scanned QR before relying on it.
    """

    serialize: bool = False
    serialize_prefix: str = ""
    serialize_start: str = "1"
    serialize_suffix: str = ""
    serialize_step: int = 1
    serialize_leading_zeros: bool = False


class TextElement(ElementBase, SerializationFields):
    type: Literal["text"] = "text"
    font: str = "0"
    font_height_dots: int = 30
    font_width_dots: int = 30
    value: str = ""
    max_length: int | None = None


class BarcodeElement(ElementBase, SerializationFields):
    type: Literal["barcode"] = "barcode"
    symbology: Literal["code128", "qr"] = "code128"
    value: str = ""
    height_dots: int = 80
    module_width: int = 2
    show_human_readable: bool = True
    qr_magnification: int = 4
    qr_error_correction: Literal["L", "M", "Q", "H"] = "M"


class LineBoxElement(ElementBase):
    type: Literal["linebox"] = "linebox"
    width_dots: int = 0
    height_dots: int = 0
    thickness_dots: int = 2
    corner_roundness: int = 0
    style: Literal["solid", "dashed", "dotted"] = "solid"
    dash_dots: int = 20
    gap_dots: int = 10


class RawElement(ElementBase):
    """Power-user escape hatch. zpl_snippet must be authored 0,0-relative
    and must not contain its own ^LH/^FW (would conflict with the wrapper
    the compiler applies around every element)."""

    type: Literal["raw"] = "raw"
    width_dots: int = 0
    height_dots: int = 0
    zpl_snippet: str = ""
    label: str = "Custom ZPL"


class GridQrElement(ElementBase):
    """N QR codes tiled evenly into a rows x cols grid inside a
    width_dots x height_dots bounding box (element's x,y is the box's
    top-left corner). Each cell's value is value_prefix + str(n).zfill(
    zero_pad_width) for n = start_number .. start_number + rows*cols - 1,
    assigned row-major (left-to-right, top-to-bottom). Values are computed
    once at compile time in Python as static ^FD content per cell, NOT via
    ^SN -- ^SN only auto-increments once per *printed copy* of the whole
    label, not N times within a single label.

    The grid fills the bounding box edge-to-edge: cell (r, c)'s top-left
    lands at local (c * width_dots/cols, r * height_dots/rows), so cells
    tile the box with no gaps rather than being spaced as N points between
    the box's edges.
    """

    type: Literal["grid-qr"] = "grid-qr"
    width_dots: int = 200
    height_dots: int = 100
    rows: int = 2
    cols: int = 5
    value_prefix: str = ""
    start_number: int = 1
    zero_pad_width: int = 2
    qr_magnification: int = 3
    qr_error_correction: Literal["L", "M", "Q", "H"] = "M"


Element = Annotated[
    Union[TextElement, BarcodeElement, LineBoxElement, RawElement, GridQrElement],
    Field(discriminator="type"),
]


class LabelDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = "Untitled Label"
    canvas: Canvas = Field(default_factory=Canvas)
    elements: list[Element] = Field(default_factory=list)
