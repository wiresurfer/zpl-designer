"""Thin wrapper around the CUPS command-line tools (lp/lpstat).

Subprocess-based rather than pycups bindings: easier to debug by hand
(every call here is reproducible on a shell), and CUPS's own tools already
handle queue discovery/job submission/status robustly.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass

from app import config

_QUEUE_LINE_RE = re.compile(r"^device for ([^:]+):\s*(.*)$")
_JOB_ID_RE = re.compile(r"request id is (\S+)")


class CupsError(RuntimeError):
    pass


@dataclass
class PrinterQueue:
    name: str
    device_uri: str


def list_queues() -> list[PrinterQueue]:
    """Enumerate configured CUPS queues via `lpstat -v`."""
    result = subprocess.run(
        ["lpstat", "-v"], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise CupsError(f"lpstat -v failed: {result.stderr.strip()}")

    queues: list[PrinterQueue] = []
    for line in result.stdout.splitlines():
        match = _QUEUE_LINE_RE.match(line.strip())
        if match:
            queues.append(PrinterQueue(name=match.group(1), device_uri=match.group(2)))
    return queues


def pick_default_queue() -> PrinterQueue | None:
    """Return the configured default queue, or auto-select one whose name
    matches a Zebra/ZPL hint, or None if nothing matches."""
    queues = list_queues()
    if not queues:
        return None

    if config.DEFAULT_QUEUE_NAME:
        for queue in queues:
            if queue.name == config.DEFAULT_QUEUE_NAME:
                return queue

    for queue in queues:
        lowered = queue.name.lower()
        if any(hint in lowered for hint in config.DEFAULT_QUEUE_NAME_HINTS):
            return queue

    return None


def submit_raw_job(queue_name: str, zpl_bytes: bytes) -> str:
    """Submit a raw ZPL byte stream to a CUPS queue, bypassing any filter
    chain the queue's driver/PPD would otherwise apply. Returns the CUPS
    job id (e.g. "ZTC-ZD230-203dpi-ZPL-42")."""
    result = subprocess.run(
        [
            "lp",
            "-d",
            queue_name,
            "-o",
            "raw",
            "-o",
            "document-format=application/vnd.cups-raw",
        ],
        input=zpl_bytes,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise CupsError(f"lp submission failed: {result.stderr.decode(errors='replace').strip()}")

    stdout = result.stdout.decode(errors="replace")
    match = _JOB_ID_RE.search(stdout)
    if not match:
        raise CupsError(f"could not parse job id from lp output: {stdout!r}")
    return match.group(1)


def job_status(job_id: str) -> str:
    """Return 'completed' if the job no longer appears in the queue, or
    'pending' if it's still there. Does not distinguish fault states from
    normal queueing -- callers needing fault detail should also check
    queue_state().

    Once a job has fully left CUPS's job history (common for fast raw
    print jobs, checked even a couple seconds after submission), `lpstat
    -o <job_id>` exits non-zero with "Invalid destination name" rather
    than exiting 0 with empty output -- that's a completed job too, not
    an error."""
    result = subprocess.run(
        ["lpstat", "-o", job_id], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        if "invalid destination" in result.stderr.lower():
            return "completed"
        raise CupsError(f"lpstat -o failed: {result.stderr.strip()}")
    return "pending" if result.stdout.strip() else "completed"


def queue_state(queue_name: str) -> str:
    """Return the raw `lpstat -p <queue>` status line, e.g. for surfacing
    fault reasons (paper out, offline, etc.) in the UI."""
    result = subprocess.run(
        ["lpstat", "-p", queue_name], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise CupsError(f"lpstat -p failed: {result.stderr.strip()}")
    return result.stdout.strip()
