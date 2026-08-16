"""LitNote 后端入口。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from . import models  # noqa: F401  确保模型注册到 Base.metadata
from .db import Base, SessionLocal, engine
from .routers import folders, notes, papers, tags

# 首次启动预置的默认笔记分栏
DEFAULT_SECTIONS = [
    ("创新点", 0),
    ("可借鉴部分", 1),
    ("结论", 2),
    ("疑问", 3),
]


def _seed_default_sections() -> None:
    """表为空时预置默认笔记分栏。"""
    with SessionLocal() as db:
        if db.execute(select(models.NoteSection)).first():
            return
        for name, order in DEFAULT_SECTIONS:
            db.add(models.NoteSection(name=name, sort_order=order, is_default=True))
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_default_sections()
    yield


app = FastAPI(title="LitNote", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(notes.sections_router, prefix="/api")
app.include_router(notes.notes_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
