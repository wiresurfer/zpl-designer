from app.compiler.schema import ROTATION_CODES, GridQrElement


def compile_grid_qr(element: GridQrElement) -> str:
    """0,0-relative ZPL for a grid-qr element: rows*cols static QR ^BQ
    blocks tiling the element's bounding box edge-to-edge, all inside the
    caller's single ^LH wrap for this one list entry -- mirrors how
    compile_linebox emits multiple ^GB segments from one LineBoxElement."""
    orientation = ROTATION_CODES[element.rotation]
    col_pitch = element.width_dots / element.cols
    row_pitch = element.height_dots / element.rows

    blocks = []
    count = element.rows * element.cols
    for i in range(count):
        r, c = divmod(i, element.cols)
        n = element.start_number + i
        dx = round(c * col_pitch)
        dy = round(r * row_pitch)
        value = f"{element.value_prefix}{str(n).zfill(element.zero_pad_width)}"
        blocks.append(
            f"^FO{dx},{dy}^BQ{orientation},2,{element.qr_magnification}"
            f"^FD{element.qr_error_correction}A,{value}^FS"
        )
    return "".join(blocks)
