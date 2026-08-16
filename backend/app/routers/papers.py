"""文献相关路由。"""

import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import DATA_DIR, get_db

router = APIRouter(prefix="/papers", tags=["papers"])

PDF_DIR = DATA_DIR / "papers"


def _load_relations(stmt):
    """为列表/详情查询预加载 tags 与 folder，避免 N+1。"""
    return stmt.options(
        selectinload(models.Paper.tags),
        selectinload(models.Paper.folder),
    )


@router.get("", response_model=List[schemas.PaperOut])
def list_papers(
    folder_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    q: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Paper).order_by(models.Paper.created_at.desc())
    if folder_id is not None:
        stmt = stmt.where(models.Paper.folder_id == folder_id)
    if tag_id is not None:
        stmt = stmt.where(models.Paper.tags.any(id=tag_id))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(models.Paper.title.ilike(like), models.Paper.abstract.ilike(like))
        )
    if year is not None:
        stmt = stmt.where(models.Paper.year == year)
    return db.execute(_load_relations(stmt)).scalars().all()


@router.get("/{paper_id}", response_model=schemas.PaperOut)
def get_paper(paper_id: int, db: Session = Depends(get_db)):
    stmt = _load_relations(select(models.Paper).where(models.Paper.id == paper_id))
    paper = db.execute(stmt).scalars().first()
    if not paper:
        raise HTTPException(status_code=404, detail="文献不存在")
    return paper


@router.post("", response_model=schemas.PaperOut, status_code=201)
def create_paper(payload: schemas.PaperCreate, db: Session = Depends(get_db)):
    paper = models.Paper(
        title=payload.title,
        authors=payload.authors,
        year=payload.year,
        venue=payload.venue,
        doi=payload.doi,
        arxiv_id=payload.arxiv_id,
        abstract=payload.abstract,
        folder_id=payload.folder_id,
    )
    if payload.tag_ids:
        tags = db.execute(
            select(models.Tag).where(models.Tag.id.in_(payload.tag_ids))
        ).scalars().all()
        paper.tags = list(tags)
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return paper


@router.put("/{paper_id}", response_model=schemas.PaperOut)
def update_paper(
    paper_id: int, payload: schemas.PaperUpdate, db: Session = Depends(get_db)
):
    paper = db.get(models.Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="文献不存在")

    data = payload.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    for key, value in data.items():
        setattr(paper, key, value)
    if tag_ids is not None:
        tags = db.execute(
            select(models.Tag).where(models.Tag.id.in_(tag_ids))
        ).scalars().all()
        paper.tags = list(tags)

    db.commit()
    db.refresh(paper)
    return paper


@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.get(models.Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="文献不存在")
    if paper.pdf_path:
        pdf = Path(paper.pdf_path)
        if pdf.exists():
            pdf.unlink()
    db.delete(paper)
    db.commit()


@router.post("/{paper_id}/pdf")
async def upload_pdf(
    paper_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    paper = db.get(models.Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="文献不存在")

    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持上传 PDF 文件")

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix or ".pdf"
    filename = f"{paper_id}_{uuid.uuid4().hex}{ext}"
    dest = PDF_DIR / filename
    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    paper.pdf_path = str(dest)
    db.commit()
    return {"paper_id": paper_id, "pdf_path": paper.pdf_path}


@router.get("/{paper_id}/pdf")
def get_pdf(paper_id: int, db: Session = Depends(get_db)):
    """返回文献的 PDF 文件，供前端 iframe 预览或下载。"""
    paper = db.get(models.Paper, paper_id)
    if not paper or not paper.pdf_path:
        raise HTTPException(status_code=404, detail="该文献没有 PDF")
    path = Path(paper.pdf_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF 文件缺失")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        content_disposition_type="inline",  # inline 内嵌显示，attachment 才是下载
    )
