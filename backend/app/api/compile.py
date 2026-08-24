from fastapi import APIRouter
from pydantic import BaseModel

from app.compiler.schema import LabelDoc
from app.compiler.zpl_compiler import compile_label

router = APIRouter(tags=["compile"])


class CompileResponse(BaseModel):
    zpl: str


@router.post("/compile", response_model=CompileResponse)
def compile_document(doc: LabelDoc, quantity: int = 1) -> CompileResponse:
    return CompileResponse(zpl=compile_label(doc, quantity=quantity))
