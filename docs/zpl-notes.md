# ZD230-specific notes and ^LH/^FW translation caveats

Running log of things discovered empirically while building against the
real printer (`ZTC-ZD230-203dpi-ZPL`, driver/PPD-backed CUPS queue, USB).

## Always emit ^PW / ^LL (discovered Phase 1)

Without explicit `^PW{width_dots}` and `^LL{height_dots}` right after
`^XA`, the printer falls back to whatever print width / label length it
has stored from its last calibration — not the 609x406 dots (3"x2" @
203dpi) this app assumes. Confirmed on real hardware: content was clipped
on the right edge ("SOFT" printed as "SO") and left a large blank area
below the design, because the stored calibration was narrower and much
taller than our intended label. The compiler now always derives `^PW`/
`^LL` from `LabelDoc.canvas` and emits them unconditionally — never rely
on the printer's own stored dimensions.

## CUPS raw printing

The existing `ZTC-ZD230-203dpi-ZPL` queue is PPD/driver-backed
(`printer-make-and-model = 'Zebra ZPL Label Printer'`), not a bare `-m raw`
queue. `lp -d <queue> -o raw -o document-format=application/vnd.cups-raw`
was confirmed on real hardware to correctly bypass the filter chain and
deliver raw ZPL bytes to the printer — no dedicated raw queue was needed
in practice.

`lpstat -o <job_id>` exits non-zero with "Invalid destination name" once a
completed job has fully left CUPS's job history (happens within a couple
seconds for small raw jobs), rather than exiting 0 with empty output —
treat that as `completed`, not an error.

## Rotation: ^FW does not work the way you'd expect (discovered Phase 2)

`^FW` (default field orientation) does **not** uniformly rotate whatever
follows it -- confirmed against Zebra's docs per command:

- `^GB` (box/line) has **no orientation parameter at all**. `^FW` cannot
  rotate it, full stop. Faked instead by computing where a box pivoted
  around its own origin by the given rotation would actually land, then
  drawing an *unrotated* `^GB` at that computed origin with width/height
  swapped for 90/270 -- see `compiler/elements/shape.py`. This reproduces
  the same visual footprint as a true rotation around the origin, matching
  the canvas editor's `ctx.rotate()` around the element's x,y.
- `^BC`/`^BQ` (barcodes) take orientation as **their own first argument**,
  which overrides `^FW` whenever explicitly set. This app previously
  hardcoded that argument to `"N"`, silently discarding rotation on every
  print regardless of what `^FW` was set to -- a real bug, confirmed via a
  physical print, fixed by always setting it from `element.rotation`.
- `^A` (text) embeds orientation as a **suffix on the font parameter**
  (e.g. `^A0R,30,30`), not a separate command -- if omitted it falls back
  to an ambient default rather than reliably tracking `^FW`. Always set
  explicitly now.

Net result: the compiler no longer uses a shared `^FW` wrapper for typed
elements at all -- each element type's compile function bakes rotation
directly into its own ZPL. `^FW` is still used, but only for the `raw`
escape-hatch element, since its content is opaque to this compiler and may
itself rely on an ambient `^FW` default. Verified end-to-end on real
hardware with the "basic" label (rotated dividers + rotated text).

## ^SN serialization works with ^BC barcodes too (discovered Phase 2)

Documentation sources disagreed on whether `^SN` (serialized data) works
with barcode fields -- one source claimed text-only ("use `^SF` for
barcodes"), another (Zebra's own "Serialized Data" advanced-techniques
page) said it works on "both alphanumeric and bar code fields." **Confirmed
on real hardware**: `^SN` placed directly after `^BC` (in place of `^FD`,
same mechanism as text fields) correctly auto-increments a Code128
barcode across `^PQ` copies, and the printed barcodes scan correctly.
Tested with an alphanumeric prefix (`^SNARM-SRG-0001,1,Y`) -- the prefix
was preserved and only the trailing digit run incremented, matching
`^SN`'s documented right-to-left digit-scan behavior. QR (`^BQ`) is not
implemented for serialization -- its `^FD` content has its own
mode-indicator prefix format (e.g. `MA,...`) and how `^SN` interacts with
that is still unconfirmed.

## Open / not yet verified

- `^LH` behavior for `^FT` (field typeset) positioning vs `^FO` — only
  `^FO`-based element content has been tested so far.
- Left/top margin: the QC grid fixture placed its first element at
  `x=15,y=10`; on the printed label there appeared to be more blank
  margin above/left of the content than that alone would suggest. Not
  yet isolated whether this is inherent printer margin, a `^LT`/label-top
  calibration offset, or just the fixture's own coordinates reading as
  more margin than intended. Revisit once more labels have been printed.
