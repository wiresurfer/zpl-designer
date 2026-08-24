import math

from app.compiler.schema import LineBoxElement, Rotation


def _rotate_rect(x: int, y: int, w: int, h: int, rotation: Rotation) -> tuple[int, int, int, int]:
    """Where a local (unrotated) rect at (x,y) sized w x h lands if pivoted
    around the global origin (0,0) by rotation degrees clockwise, expressed
    as the axis-aligned (ox, oy, dw, dh) an unrotated ^GB would need to
    reproduce that same footprint -- ^GB has no orientation parameter, so
    this is how rotation is faked for box/line content. Exact for 0/90/
    180/270 since those map an axis-aligned rect to another axis-aligned
    rect with no shear.
    """
    if rotation == 0:
        return x, y, w, h
    theta = math.radians(rotation)
    cos_t = round(math.cos(theta))
    sin_t = round(math.sin(theta))
    corners = [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]
    xs = [cx * cos_t - cy * sin_t for cx, cy in corners]
    ys = [cx * sin_t + cy * cos_t for cx, cy in corners]
    ox, oy = min(xs), min(ys)
    return ox, oy, max(xs) - ox, max(ys) - oy


def _dash_segments(
    width: int, height: int, thickness: int, dash_dots: int, gap_dots: int
) -> list[tuple[int, int, int, int]]:
    """Local (unrotated) rects covering a dashed/dotted line, stepping
    along whichever of width/height is longer; each segment is thickness
    dots wide in the cross direction so dashes read as a stroke rather
    than filled blocks. Only covers the single-line case (one dimension ~
    the line's thickness) -- a genuinely dashed *box border* would need
    all 4 edges segmented separately, which isn't implemented; a
    box-shaped element with style != solid still dashes along its longer
    dimension only."""
    dash_dots = max(dash_dots, 1)
    gap_dots = max(gap_dots, 0)
    cross = max(thickness, 1)
    horizontal = width >= height
    length = width if horizontal else height
    segments = []
    pos = 0
    while pos < length:
        seg_len = min(dash_dots, length - pos)
        segments.append((pos, 0, seg_len, cross) if horizontal else (0, pos, cross, seg_len))
        pos += dash_dots + gap_dots
    return segments


def compile_linebox(element: LineBoxElement) -> str:
    """0,0-relative ZPL for a line/box graphic, one or more ^GB blocks."""
    width = max(element.width_dots, 1)
    height = max(element.height_dots, 1)

    if element.style == "solid":
        rects = [(0, 0, width, height)]
    else:
        rects = _dash_segments(width, height, element.thickness_dots, element.dash_dots, element.gap_dots)

    blocks = []
    for x, y, w, h in rects:
        ox, oy, dw, dh = _rotate_rect(x, y, w, h, element.rotation)
        blocks.append(f"^FO{ox},{oy}^GB{dw},{dh},{element.thickness_dots},B,{element.corner_roundness}^FS")
    return "".join(blocks)
