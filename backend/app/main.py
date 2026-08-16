"""LitNote 后端入口。"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import models  # noqa: F401  确保模型注册到 Base.metadata
from .db import Base, SessionLocal, engine
from .routers import folders, metadata, notes, papers, tags

# 首次启动预置的默认笔记分栏
# 注：「关键词」用标签系统实现（tags），不单独做笔记分栏
DEFAULT_SECTIONS = [
    ("创新点", 0),
    ("借鉴内容", 1),
    ("主要内容", 2),
    ("结论", 3),
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
app.include_router(metadata.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------- 托管前端构建产物（单端口运行） ----------
# 若 frontend/dist 已构建，则后端同时提供前端页面与接口，单端口即可使用。
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
