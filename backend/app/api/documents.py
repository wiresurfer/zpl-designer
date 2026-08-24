from fastapi import APIRouter, HTTPException

from app.compiler.schema import LabelDoc
from app.storage import models

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[LabelDoc])
def list_documents() -> list[LabelDoc]:
    return models.list_labels()


@router.get("/{label_id}", response_model=LabelDoc)
def get_document(label_id: str) -> LabelDoc:
    doc = models.get_label(label_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="label not found")
    return doc


@router.put("/{label_id}", response_model=LabelDoc)
def save_document(label_id: str, doc: LabelDoc) -> LabelDoc:
    if doc.id != label_id:
        raise HTTPException(status_code=400, detail="id in body must match path")
    models.save_label(doc)
    return doc


@router.post("", response_model=LabelDoc)
def create_document(doc: LabelDoc) -> LabelDoc:
    models.save_label(doc)
    return doc


@router.delete("/{label_id}")
def delete_document(label_id: str) -> dict:
    deleted = models.delete_label(label_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="label not found")
    return {"deleted": True}
