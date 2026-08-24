from fastapi import APIRouter
from pydantic import BaseModel

from app.printing.cups_client import PrinterQueue, list_queues, pick_default_queue

router = APIRouter(prefix="/printers", tags=["printers"])


class PrintersResponse(BaseModel):
    queues: list[PrinterQueue]
    default_queue_name: str | None


@router.get("", response_model=PrintersResponse)
def get_printers() -> PrintersResponse:
    queues = list_queues()
    default = pick_default_queue()
    return PrintersResponse(
        queues=queues, default_queue_name=default.name if default else None
    )
