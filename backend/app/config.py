import os

CANVAS_WIDTH_DOTS = 609
CANVAS_HEIGHT_DOTS = 406
CANVAS_DPI = 203

# Substring match used to auto-select a CUPS queue when none is specified.
DEFAULT_QUEUE_NAME_HINTS = ("zebra", "zpl", "zd230")

# Explicit override, e.g. "ZTC-ZD230-203dpi-ZPL"
DEFAULT_QUEUE_NAME = os.environ.get("ZPL_APP_DEFAULT_QUEUE")

DB_PATH = os.environ.get(
    "ZPL_APP_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "labels.db"),
)

RENDERER_SIDECAR_URL = os.environ.get("ZPL_APP_RENDERER_URL")
