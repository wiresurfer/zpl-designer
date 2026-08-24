import subprocess
from unittest.mock import patch

import pytest

from app import config
from app.printing import cups_client
from app.printing.cups_client import CupsError


def _completed(stdout="", stderr="", returncode=0, stdout_bytes=None):
    return subprocess.CompletedProcess(
        args=[],
        returncode=returncode,
        stdout=stdout_bytes if stdout_bytes is not None else stdout,
        stderr=stderr if stdout_bytes is None else stderr.encode(),
    )


LPSTAT_V_OUTPUT = (
    "device for ZTC-ZD230-203dpi-ZPL: "
    "usb://Zebra%20Technologies/ZTC%20ZD230-203dpi%20ZPL?serial=DOJ254300662\n"
    "device for Office-Laser: ipp://printserver/office-laser\n"
)


def test_list_queues_parses_lpstat_v_output():
    with patch("app.printing.cups_client.subprocess.run", return_value=_completed(LPSTAT_V_OUTPUT)):
        queues = cups_client.list_queues()

    assert len(queues) == 2
    assert queues[0].name == "ZTC-ZD230-203dpi-ZPL"
    assert queues[0].device_uri.startswith("usb://Zebra")
    assert queues[1].name == "Office-Laser"


def test_list_queues_raises_on_nonzero_exit():
    with patch(
        "app.printing.cups_client.subprocess.run",
        return_value=_completed(returncode=1, stderr="lpstat: command not found"),
    ):
        with pytest.raises(CupsError):
            cups_client.list_queues()


def test_pick_default_queue_matches_zebra_hint():
    with patch("app.printing.cups_client.subprocess.run", return_value=_completed(LPSTAT_V_OUTPUT)):
        queue = cups_client.pick_default_queue()

    assert queue is not None
    assert queue.name == "ZTC-ZD230-203dpi-ZPL"


def test_pick_default_queue_none_when_no_match():
    output = "device for Office-Laser: ipp://printserver/office-laser\n"
    with patch("app.printing.cups_client.subprocess.run", return_value=_completed(output)):
        queue = cups_client.pick_default_queue()
    assert queue is None


def test_pick_default_queue_prefers_explicit_config_override():
    with patch.object(config, "DEFAULT_QUEUE_NAME", "Office-Laser"):
        with patch("app.printing.cups_client.subprocess.run", return_value=_completed(LPSTAT_V_OUTPUT)):
            queue = cups_client.pick_default_queue()
    assert queue is not None
    assert queue.name == "Office-Laser"


def test_submit_raw_job_parses_job_id():
    stdout = b"request id is ZTC-ZD230-203dpi-ZPL-42 (1 file(s))\n"
    with patch(
        "app.printing.cups_client.subprocess.run",
        return_value=_completed(stdout_bytes=stdout, returncode=0),
    ) as mock_run:
        job_id = cups_client.submit_raw_job("ZTC-ZD230-203dpi-ZPL", b"^XA^XZ")

    assert job_id == "ZTC-ZD230-203dpi-ZPL-42"
    args = mock_run.call_args.args[0]
    assert args[:2] == ["lp", "-d"]
    assert "-o" in args and "raw" in args
    assert mock_run.call_args.kwargs["input"] == b"^XA^XZ"


def test_submit_raw_job_raises_on_failure():
    with patch(
        "app.printing.cups_client.subprocess.run",
        return_value=_completed(stdout_bytes=b"", returncode=1, stderr="lp: unable to access queue"),
    ):
        with pytest.raises(CupsError):
            cups_client.submit_raw_job("nonexistent-queue", b"^XA^XZ")


def test_job_status_pending_when_job_listed():
    with patch(
        "app.printing.cups_client.subprocess.run",
        return_value=_completed("ZTC-ZD230-203dpi-ZPL-42 armory 512 ...\n"),
    ):
        assert cups_client.job_status("ZTC-ZD230-203dpi-ZPL-42") == "pending"


def test_job_status_completed_when_job_absent():
    with patch("app.printing.cups_client.subprocess.run", return_value=_completed("")):
        assert cups_client.job_status("ZTC-ZD230-203dpi-ZPL-42") == "completed"


def test_job_status_completed_when_job_purged_from_history():
    """Once a job fully leaves CUPS's history, lpstat -o exits non-zero
    with 'Invalid destination name' rather than exiting 0 with empty
    output -- that's still a completed job, not an error."""
    with patch(
        "app.printing.cups_client.subprocess.run",
        return_value=_completed(
            returncode=1,
            stderr='lpstat: Invalid destination name in list "ZTC-ZD230-203dpi-ZPL-2".',
        ),
    ):
        assert cups_client.job_status("ZTC-ZD230-203dpi-ZPL-2") == "completed"
