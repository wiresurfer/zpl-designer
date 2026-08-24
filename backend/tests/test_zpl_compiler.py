import re

from app.compiler.schema import (
    BarcodeElement,
    Canvas,
    GridQrElement,
    LabelDoc,
    LineBoxElement,
    RawElement,
    TextElement,
)
from app.compiler.zpl_compiler import compile_label

_LH_PAIR_RE = re.compile(r"\^LH(\d+),(\d+)(.*?)\^LH0,0", re.DOTALL)


def test_empty_label_compiles_to_bare_frame_with_default_dims():
    doc = LabelDoc(elements=[])
    assert compile_label(doc) == "^XA^PW609^LL406^XZ"


def test_label_dims_always_emitted_from_canvas():
    """Without explicit ^PW/^LL, the printer falls back to its last
    calibrated width/length, which can silently clip or leave large blank
    space -- confirmed on a real ZD230 print. These must always be
    derived from the doc's own canvas, not the printer's stored state."""
    doc = LabelDoc(canvas=Canvas(width_dots=800, height_dots=1200, dpi=203), elements=[])
    zpl = compile_label(doc)
    assert "^PW800" in zpl
    assert "^LL1200" in zpl
    assert zpl.index("^PW800") < zpl.index("^LL1200")
    # dims must come immediately after ^XA, before any element content
    assert zpl.startswith("^XA^PW800^LL1200")


def test_quantity_one_omits_pq():
    doc = LabelDoc(elements=[])
    zpl = compile_label(doc, quantity=1)
    assert "^PQ" not in zpl


def test_quantity_above_one_appends_pq_before_xz():
    doc = LabelDoc(elements=[])
    zpl = compile_label(doc, quantity=25)
    assert zpl.endswith("^PQ25^XZ")


def test_text_serialization_replaces_fd_with_sn():
    doc = LabelDoc(
        elements=[
            TextElement(
                x=10,
                y=10,
                value="ignored when serialized",
                serialize=True,
                serialize_start="100",
                serialize_step=5,
                serialize_leading_zeros=True,
            )
        ]
    )
    zpl = compile_label(doc, quantity=10)
    assert "^SN100,5,Y^FS" in zpl
    assert "^FD" not in zpl
    assert zpl.endswith("^PQ10^XZ")


def test_text_without_serialization_still_uses_fd():
    doc = LabelDoc(elements=[TextElement(x=0, y=0, value="static")])
    zpl = compile_label(doc)
    assert "^FDstatic^FS" in zpl
    assert "^SN" not in zpl


def test_text_serialization_prefix_and_suffix_concatenated_into_start_value():
    """^SN's own start value natively preserves prefix/suffix text around
    the digit run it increments (right-to-left scan for trailing digits)
    -- prefix/suffix are just a friendlier split for the property panel,
    concatenated back into one string here."""
    doc = LabelDoc(
        elements=[
            TextElement(
                x=0,
                y=0,
                value="",
                serialize=True,
                serialize_prefix="ARM-SRG-",
                serialize_start="0001",
                serialize_suffix="",
                serialize_step=1,
                serialize_leading_zeros=True,
            )
        ]
    )
    zpl = compile_label(doc)
    assert "^SNARM-SRG-0001,1,Y^FS" in zpl


def test_barcode_code128_serialization_replaces_fd_with_sn():
    doc = LabelDoc(
        elements=[
            BarcodeElement(
                x=0,
                y=0,
                symbology="code128",
                value="ignored",
                serialize=True,
                serialize_prefix="CH-",
                serialize_start="00001",
                serialize_step=1,
                serialize_leading_zeros=True,
            )
        ]
    )
    zpl = compile_label(doc)
    assert "^SNCH-00001,1,Y^FS" in zpl
    assert "^FD" not in zpl


def test_barcode_qr_without_serialization_still_uses_fd():
    doc = LabelDoc(elements=[BarcodeElement(x=0, y=0, symbology="qr", value="hello")])
    zpl = compile_label(doc)
    assert "^FDMA,hello^FS" in zpl
    assert "^SN" not in zpl


def test_barcode_qr_serialization_prepends_mode_indicator_before_sn_start():
    """QR's ^FD content has its own mode-indicator prefix (error
    correction + input mode, e.g. "MA,"). ^SN doesn't know or care about
    that semantics -- it just finds and increments the trailing digit run
    in whatever string it's given -- so the mode indicator is prepended
    as more fixed text ahead of the user's own prefix/start/suffix."""
    doc = LabelDoc(
        elements=[
            BarcodeElement(
                x=0,
                y=0,
                symbology="qr",
                qr_error_correction="M",
                serialize=True,
                serialize_prefix="ARM-",
                serialize_start="0001",
                serialize_step=1,
                serialize_leading_zeros=True,
            )
        ]
    )
    zpl = compile_label(doc)
    assert "^SNMA,ARM-0001,1,Y^FS" in zpl
    assert "^FD" not in zpl


def test_barcode_without_serialization_still_uses_fd():
    doc = LabelDoc(elements=[BarcodeElement(x=0, y=0, symbology="code128", value="12345")])
    zpl = compile_label(doc)
    assert "^FD12345^FS" in zpl
    assert "^SN" not in zpl


def test_text_element_wrapped_with_lh_and_reset():
    doc = LabelDoc(elements=[TextElement(x=20, y=10, value="Chassis No:")])
    zpl = compile_label(doc)

    assert zpl.startswith("^XA")
    assert zpl.endswith("^XZ")
    assert "^LH20,10" in zpl
    assert zpl.count("^LH0,0") == 1
    # the reset must come after this element's content
    assert zpl.index("^LH20,10") < zpl.index("^FDChassis No:") < zpl.rindex("^LH0,0")


def test_barcode_element_code128():
    doc = LabelDoc(
        elements=[
            BarcodeElement(x=20, y=60, symbology="code128", value="CH-000123", height_dots=80)
        ]
    )
    zpl = compile_label(doc)
    assert "^LH20,60" in zpl
    assert "^BCN,80,Y,N,N" in zpl
    assert "^FDCH-000123^FS" in zpl


def test_barcode_element_qr():
    doc = LabelDoc(
        elements=[BarcodeElement(x=5, y=5, symbology="qr", value="RACK-01", qr_magnification=3)]
    )
    zpl = compile_label(doc)
    assert "^BQN,2,3" in zpl
    assert "^FDMA,RACK-01^FS" in zpl


def test_linebox_element():
    doc = LabelDoc(elements=[LineBoxElement(x=0, y=0, width_dots=200, height_dots=40, thickness_dots=2)])
    zpl = compile_label(doc)
    assert "^GB200,40,2,B,0" in zpl


def test_linebox_solid_is_single_gb_block():
    doc = LabelDoc(elements=[LineBoxElement(x=0, y=0, width_dots=100, height_dots=2, style="solid")])
    zpl = compile_label(doc)
    assert zpl.count("^GB") == 1


def test_linebox_dashed_emits_multiple_gb_segments_with_gaps():
    """^GB draws only solid boxes -- dashed/dotted lines are faked as a
    row of small ^GB segments with gaps between them."""
    doc = LabelDoc(
        elements=[
            LineBoxElement(
                x=0, y=0, width_dots=100, height_dots=2, thickness_dots=2, style="dashed", dash_dots=20, gap_dots=10
            )
        ]
    )
    zpl = compile_label(doc)
    # 100 dots long, 20 dash + 10 gap = 30 dot period -> segments at 0,30,60,90
    assert zpl.count("^GB") == 4
    assert "^FO0,0^GB20,2,2,B,0^FS" in zpl
    assert "^FO30,0^GB20,2,2,B,0^FS" in zpl
    assert "^FO60,0^GB20,2,2,B,0^FS" in zpl
    # last segment clipped to remaining length (100-90=10)
    assert "^FO90,0^GB10,2,2,B,0^FS" in zpl


def test_linebox_dotted_uses_thickness_sized_segments():
    doc = LabelDoc(
        elements=[
            LineBoxElement(
                x=0, y=0, width_dots=30, height_dots=2, thickness_dots=2, style="dotted", dash_dots=2, gap_dots=4
            )
        ]
    )
    zpl = compile_label(doc)
    # 2 dot + 4 gap = 6 dot period over 30 dots -> 5 dots
    assert zpl.count("^GB") == 5
    assert "^GB2,2,2,B,0" in zpl


def test_linebox_dashed_vertical_line_steps_along_height():
    doc = LabelDoc(
        elements=[
            LineBoxElement(
                x=0, y=0, width_dots=2, height_dots=50, thickness_dots=2, style="dashed", dash_dots=20, gap_dots=10
            )
        ]
    )
    zpl = compile_label(doc)
    assert "^FO0,0^GB2,20,2,B,0^FS" in zpl
    assert "^FO0,30^GB2,20,2,B,0^FS" in zpl


def test_raw_element_is_passthrough_and_still_wrapped():
    doc = LabelDoc(elements=[RawElement(x=15, y=25, zpl_snippet="^FO0,0^GFA,1,1,1,:Z64:^FS")])
    zpl = compile_label(doc)
    assert "^LH15,25" in zpl
    assert "^FO0,0^GFA,1,1,1,:Z64:^FS" in zpl
    assert zpl.count("^LH0,0") == 1


def test_text_rotation_embeds_in_font_command_not_fw():
    """^FW cannot be trusted here: ^A's orientation can only be set as a
    suffix on its own font parameter (^A0R,...), and if omitted it falls
    back to an ambient default rather than reliably picking up ^FW. Always
    emitting it explicitly avoids depending on that ambient state."""
    doc = LabelDoc(elements=[TextElement(x=0, y=0, value="R", rotation=90, font="0")])
    zpl = compile_label(doc)
    assert "^A0R,30,30" in zpl
    assert "^FW" not in zpl


def test_text_no_rotation_still_explicit_normal_orientation():
    doc = LabelDoc(elements=[TextElement(x=0, y=0, value="R", rotation=0, font="0")])
    zpl = compile_label(doc)
    assert "^A0N,30,30" in zpl
    assert "^FW" not in zpl


def test_barcode_rotation_sets_bc_orientation_argument_not_fw():
    """^BC takes orientation as its own first argument, which overrides
    ^FW whenever set -- previously this was hardcoded to "N", silently
    discarding rotation on every print regardless of ^FW."""
    doc = LabelDoc(
        elements=[BarcodeElement(x=0, y=0, symbology="code128", value="X", rotation=270)]
    )
    zpl = compile_label(doc)
    assert "^BCB," in zpl
    assert "^FW" not in zpl


def test_qr_rotation_sets_bq_orientation_argument():
    doc = LabelDoc(elements=[BarcodeElement(x=0, y=0, symbology="qr", value="X", rotation=180)])
    zpl = compile_label(doc)
    assert "^BQI," in zpl
    assert "^FW" not in zpl


def test_linebox_rotation_has_no_orientation_param_and_no_fw():
    """^GB has no orientation parameter at all -- confirmed against
    Zebra's docs -- so ^FW can't rotate it either; rotation must be faked
    via origin-shift + dimension-swap instead (see other linebox tests)."""
    doc = LabelDoc(elements=[LineBoxElement(x=0, y=0, width_dots=10, height_dots=5, rotation=90)])
    zpl = compile_label(doc)
    assert "^FW" not in zpl


def test_linebox_90_rotation_shifts_origin_and_swaps_dimensions():
    """A width x height box pivoted 90deg clockwise around its own origin
    (0,0) occupies local x in [-height, 0], y in [0, width] -- so an
    unrotated ^GB reproducing that footprint needs origin (-height, 0)
    and swapped width/height."""
    doc = LabelDoc(elements=[LineBoxElement(x=100, y=50, width_dots=30, height_dots=10, thickness_dots=2)])
    zpl_0 = compile_label(doc)
    assert "^FO0,0^GB30,10,2,B,0^FS" in zpl_0

    doc.elements[0].rotation = 90
    zpl_90 = compile_label(doc)
    assert "^FO-10,0^GB10,30,2,B,0^FS" in zpl_90


def test_linebox_180_rotation_shifts_origin_keeps_dimensions():
    doc = LabelDoc(elements=[LineBoxElement(x=0, y=0, width_dots=30, height_dots=10, thickness_dots=2, rotation=180)])
    zpl = compile_label(doc)
    assert "^FO-30,-10^GB30,10,2,B,0^FS" in zpl


def test_linebox_270_rotation_shifts_origin_and_swaps_dimensions():
    doc = LabelDoc(elements=[LineBoxElement(x=0, y=0, width_dots=30, height_dots=10, thickness_dots=2, rotation=270)])
    zpl = compile_label(doc)
    assert "^FO0,-30^GB10,30,2,B,0^FS" in zpl


def test_raw_element_rotation_still_uses_fw_since_content_is_opaque():
    """The raw escape hatch is the one case where ^FW wrapping still
    makes sense: its ZPL content is arbitrary and unparsed, so it may
    itself rely on an ambient ^FW default (e.g. a bare ^A with no
    explicit orientation)."""
    doc = LabelDoc(elements=[RawElement(x=0, y=0, zpl_snippet="^FO0,0^A0,20,20^FDx^FS", rotation=90)])
    zpl = compile_label(doc)
    assert "^FWR" in zpl
    assert "^FWN" in zpl


def test_multiple_elements_never_leak_lh_offset_between_each_other():
    """The core invariant: every ^LH{x},{y} must be immediately followed,
    after that element's own content, by a ^LH0,0 reset -- so no element's
    offset can bleed into the next element's placement."""
    doc = LabelDoc(
        elements=[
            TextElement(x=20, y=10, value="Chassis No:"),
            BarcodeElement(x=20, y=60, symbology="code128", value="CH-000123"),
            LineBoxElement(x=5, y=90, width_dots=600, height_dots=2, thickness_dots=2),
        ]
    )
    zpl = compile_label(doc)

    # exactly one ^LH0,0 reset per element
    assert zpl.count("^LH0,0") == len(doc.elements)

    # every ^LH{x},{y} (excluding the resets themselves) is immediately
    # followed somewhere later by exactly one ^LH0,0 before the next ^LH
    offset_positions = [
        m.start() for m in re.finditer(r"\^LH(?!0,0)\d+,\d+", zpl)
    ]
    reset_positions = [m.start() for m in re.finditer(r"\^LH0,0", zpl)]
    assert len(offset_positions) == len(reset_positions) == len(doc.elements)
    for offset_pos, reset_pos in zip(offset_positions, reset_positions):
        assert offset_pos < reset_pos


def test_multiple_elements_preserve_paint_order():
    doc = LabelDoc(
        elements=[
            TextElement(x=1, y=1, value="first"),
            TextElement(x=2, y=2, value="second"),
        ]
    )
    zpl = compile_label(doc)
    assert zpl.index("first") < zpl.index("second")


def test_grid_qr_emits_rows_times_cols_codes():
    doc = LabelDoc(
        elements=[GridQrElement(x=0, y=0, width_dots=200, height_dots=100, rows=2, cols=5)]
    )
    zpl = compile_label(doc)
    assert zpl.count("^BQ") == 10
    assert zpl.count("^FD") == 10


def test_grid_qr_value_sequence_prefix_and_zero_pad():
    doc = LabelDoc(
        elements=[
            GridQrElement(
                x=0,
                y=0,
                width_dots=200,
                height_dots=100,
                rows=2,
                cols=5,
                value_prefix="ARM-SRG-00",
                start_number=1,
                zero_pad_width=2,
            )
        ]
    )
    zpl = compile_label(doc)
    assert "^FDMA,ARM-SRG-0001^FS" in zpl
    assert "^FDMA,ARM-SRG-0010^FS" in zpl


def test_grid_qr_row_major_cell_offsets():
    doc = LabelDoc(
        elements=[GridQrElement(x=0, y=0, width_dots=200, height_dots=100, rows=2, cols=5)]
    )
    zpl = compile_label(doc)
    # cell (0,0) sits at the element's local origin
    assert "^FO0,0^BQN,2," in zpl
    # last column of row 0: col_pitch = 200/5 = 40, c=4 -> dx=160
    assert "^FO160,0^BQN,2," in zpl


def test_grid_qr_respects_element_lh_wrapper():
    doc = LabelDoc(
        elements=[
            TextElement(x=5, y=5, value="header"),
            GridQrElement(x=20, y=40, width_dots=200, height_dots=100, rows=2, cols=5),
        ]
    )
    zpl = compile_label(doc)
    assert zpl.count("^LH0,0") == len(doc.elements)


def test_grid_qr_rotation_uses_bq_orientation_arg():
    doc = LabelDoc(
        elements=[GridQrElement(x=0, y=0, width_dots=200, height_dots=100, rows=1, cols=1, rotation=90)]
    )
    zpl = compile_label(doc)
    assert "^BQR,2," in zpl
    assert "^FWR" not in zpl
