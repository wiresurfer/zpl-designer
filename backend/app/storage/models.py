from app.compiler.schema import LabelDoc
from app.storage.db import connect


def save_label(doc: LabelDoc) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO labels (id, name, doc_json, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                doc_json = excluded.doc_json,
                updated_at = excluded.updated_at
            """,
            (doc.id, doc.name, doc.model_dump_json()),
        )


def get_label(label_id: str) -> LabelDoc | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT doc_json FROM labels WHERE id = ?", (label_id,)
        ).fetchone()
    if row is None:
        return None
    return LabelDoc.model_validate_json(row[0])


def list_labels() -> list[LabelDoc]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT doc_json FROM labels ORDER BY updated_at DESC"
        ).fetchall()
    return [LabelDoc.model_validate_json(row[0]) for row in rows]


def delete_label(label_id: str) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM labels WHERE id = ?", (label_id,))
    return cursor.rowcount > 0
