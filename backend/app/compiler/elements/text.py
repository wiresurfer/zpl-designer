from app.compiler.schema import ROTATION_CODES, TextElement


def compile_text(element: TextElement) -> str:
    """0,0-relative ZPL for a text field.

    Orientation is embedded directly in ^A's font parameter (e.g. ^A0R for
    font 0 rotated 90 deg) rather than relying on an ambient ^FW default --
    always setting it explicitly means this field's rotation can never be
    silently overridden by whatever ^FW state happens to be active.
    """
    orientation = ROTATION_CODES[element.rotation]
    prefix_cmd = f"^FO0,0^A{element.font}{orientation},{element.font_height_dots},{element.font_width_dots}"

    if element.serialize:
        # ^SN replaces ^FD entirely -- the printer supplies this field's
        # data itself, incrementing by serialize_step on each copy of a
        # ^PQ multi-quantity print run. Its start value natively preserves
        # prefix/suffix text around the digit run it increments.
        zeros = "Y" if element.serialize_leading_zeros else "N"
        start = f"{element.serialize_prefix}{element.serialize_start}{element.serialize_suffix}"
        return f"{prefix_cmd}^SN{start},{element.serialize_step},{zeros}^FS"

    value = element.value
    if element.max_length is not None:
        value = value[: element.max_length]
    return f"{prefix_cmd}^FD{value}^FS"
