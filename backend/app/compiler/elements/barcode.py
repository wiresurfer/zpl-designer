from app.compiler.schema import ROTATION_CODES, BarcodeElement


def _serialized_data(element: BarcodeElement, data_prefix: str = "") -> str:
    """^SN's start value (v), used in place of ^FD -- see
    SerializationFields docstring. ^SN's right-to-left digit scan finds
    and increments whatever trailing digit run exists in this string,
    preserving everything else literally, so any fixed prefix -- the
    user's own serialize_prefix, or a symbology's own data-format prefix
    like QR's mode indicator (data_prefix) -- just rides along unchanged.
    """
    zeros = "Y" if element.serialize_leading_zeros else "N"
    start = f"{data_prefix}{element.serialize_prefix}{element.serialize_start}{element.serialize_suffix}"
    return f"^SN{start},{element.serialize_step},{zeros}^FS"


def compile_barcode(element: BarcodeElement) -> str:
    """0,0-relative ZPL for a barcode field.

    ^BC and ^BQ each take orientation as their own first argument -- it is
    NOT inherited from ^FW unless that argument is omitted. Previously this
    was hardcoded to "N", silently discarding the element's rotation on
    every print; it must always be set explicitly from element.rotation.
    """
    orientation = ROTATION_CODES[element.rotation]
    if element.symbology == "code128":
        human_readable = "Y" if element.show_human_readable else "N"
        prefix_cmd = f"^BY{element.module_width}^FO0,0^BC{orientation},{element.height_dots},{human_readable},N,N"
        if element.serialize:
            return f"{prefix_cmd}{_serialized_data(element)}"
        return f"{prefix_cmd}^FD{element.value}^FS"

    # qr
    prefix_cmd = f"^FO0,0^BQ{orientation},2,{element.qr_magnification}"
    if element.serialize:
        return f"{prefix_cmd}{_serialized_data(element, data_prefix=f'{element.qr_error_correction}A,')}"
    return f"{prefix_cmd}^FD{element.qr_error_correction}A,{element.value}^FS"
