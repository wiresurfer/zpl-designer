from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import compile as compile_api
from app.api import documents, print_jobs, printers
from app.storage.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="zpl-designer", lifespan=lifespan)

app.include_router(documents.router)
app.include_router(compile_api.router)
app.include_router(printers.router)
app.include_router(print_jobs.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
