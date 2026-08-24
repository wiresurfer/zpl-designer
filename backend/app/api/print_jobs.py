from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.compiler.schema import LabelDoc
from app.compiler.zpl_compiler import compile_label
from app.printing.cups_client import CupsError, job_status, pick_default_queue, submit_raw_job

router = APIRouter(prefix="/print_jobs", tags=["print_jobs"])


class PrintJobRequest(BaseModel):
    label: LabelDoc
    queue_name: str | None = None
    quantity: int = 1


class PrintJobResponse(BaseModel):
    job_id: str
    queue_name: str
    zpl: str


class PrintJobStatusResponse(BaseModel):
    job_id: str
    status: str


@router.post("", response_model=PrintJobResponse)
def submit_print_job(request: PrintJobRequest) -> PrintJobResponse:
    queue_name = request.queue_name
    if queue_name is None:
        default = pick_default_queue()
        if default is None:
            raise HTTPException(status_code=400, detail="no printer queue configured or matched")
        queue_name = default.name

    zpl = compile_label(request.label, quantity=request.quantity)
    try:
        job_id = submit_raw_job(queue_name, zpl.encode("utf-8"))
    except CupsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return PrintJobResponse(job_id=job_id, queue_name=queue_name, zpl=zpl)


@router.get("/{job_id}", response_model=PrintJobStatusResponse)
def get_print_job_status(job_id: str) -> PrintJobStatusResponse:
    try:
        status = job_status(job_id)
    except CupsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return PrintJobStatusResponse(job_id=job_id, status=status)
