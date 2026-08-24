"""LabelDoc -> ZPL string compiler.

Each element type has a per-type compiler function that emits ZPL content
as if the element's own top-left corner were the label origin (0,0). This
module wraps every element's block with ^LH{x},{y} before it and ^LH0,0
immediately after, using ZPL's native Label Home command as the coordinate
translation primitive.

^LH shifts the origin used by subsequent ^FO-relative field placements
until the next ^LH call. This is robust to multi-command element content
(e.g. a barcode block is ^BY + ^FO + ^BC + ^FD + ^FS, only one of which
carries a coordinate) and works even for the raw escape-hatch element,
whose content is arbitrary user-authored ZPL that this compiler never
parses.

Invariant that must never be violated: every ^LH{x},{y} is immediately
followed by ^LH0,0 after that element's block, so one element's offset can
never leak into the next.

Rotation is NOT handled via a shared ^FW wrapper -- confirmed against
Zebra's docs that ^FW's effect varies by command (^GB ignores it entirely;
^BC/^BQ have their own orientation argument that overrides it whenever
explicitly set; ^A embeds orientation in its font parameter). Each typed
element's own compile function bakes rotation directly into its ZPL for
this reason -- see elements/text.py, elements/barcode.py, elements/shape.py.
^FW is used here only for the raw escape-hatch element, whose content is
opaque to this compiler and may itself rely on an ambient ^FW default.
"""

from __future__ import annotations

from app.compiler.elements.barcode import compile_barcode
from app.compiler.elements.grid_qr import compile_grid_qr
from app.compiler.elements.raw_snippet import compile_raw
from app.compiler.elements.shape import compile_linebox
from app.compiler.elements.text import compile_text
from app.compiler.schema import (
    ROTATION_CODES,
    BarcodeElement,
    Element,
    GridQrElement,
    LabelDoc,
    LineBoxElement,
    RawElement,
    TextElement,
)


def _compile_element(element: Element) -> str:
    lines = [f"^LH{element.x},{element.y}"]
    if isinstance(element, TextElement):
        lines.append(compile_text(element))
    elif isinstance(element, BarcodeElement):
        lines.append(compile_barcode(element))
    elif isinstance(element, LineBoxElement):
        lines.append(compile_linebox(element))
    elif isinstance(element, GridQrElement):
        lines.append(compile_grid_qr(element))
    elif isinstance(element, RawElement):
        if element.rotation != 0:
            lines.append(f"^FW{ROTATION_CODES[element.rotation]}")
        lines.append(compile_raw(element))
        if element.rotation != 0:
            lines.append("^FWN")
    else:
        raise TypeError(f"Unknown element type: {type(element)!r}")
    lines.append("^LH0,0")
    return "".join(lines)


def compile_label(doc: LabelDoc, quantity: int = 1) -> str:
    """Compile a LabelDoc into a complete ZPL document (^XA...^XZ).

    Always emits ^PW (print width) and ^LL (label length) from the doc's
    own canvas dimensions. Without these, the printer falls back to
    whatever width/length it has stored from its last calibration, which
    can silently clip content on the right edge (^PW too narrow) or leave
    large blank space below the design (^LL too tall) -- confirmed on a
    real ZD230 print during Phase 1 testing.

    quantity > 1 appends ^PQ so the printer itself prints that many copies
    of this one label format in a single job -- any text element with
    serialize=True auto-increments (^SN) on each copy. quantity == 1 omits
    ^PQ entirely, matching the original single-print behavior.
    """
    body = "".join(_compile_element(element) for element in doc.elements)
    dims = f"^PW{doc.canvas.width_dots}^LL{doc.canvas.height_dots}"
    pq = f"^PQ{quantity}" if quantity != 1 else ""
    return f"^XA{dims}{body}{pq}^XZ"
