"""笔记与笔记分栏相关路由。"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

sections_router = APIRouter(prefix="/note-sections", tags=["note-sections"])
notes_router = APIRouter(prefix="/notes", tags=["notes"])


# ---------- 笔记分栏 ----------
@sections_router.get("", response_model=List[schemas.NoteSectionOut])
def list_sections(db: Session = Depends(get_db)):
    return (
        db.execute(
            select(models.NoteSection).order_by(models.NoteSection.sort_order)
        )
        .scalars()
        .all()
    )


@sections_router.post("", response_model=schemas.NoteSectionOut, status_code=201)
def create_section(payload: schemas.NoteSectionCreate, db: Session = Depends(get_db)):
    section = models.NoteSection(
        name=payload.name,
        sort_order=payload.sort_order,
        is_default=payload.is_default,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@sections_router.put("/{section_id}", response_model=schemas.NoteSectionOut)
def update_section(
    section_id: int, payload: schemas.NoteSectionUpdate, db: Session = Depends(get_db)
):
    section = db.get(models.NoteSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="分栏不存在")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(section, key, value)
    db.commit()
    db.refresh(section)
    return section


@sections_router.delete("/{section_id}", status_code=204)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = db.get(models.NoteSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="分栏不存在")
    db.delete(section)  # 关联 notes 由 cascade="all, delete-orphan" 一并删除
    db.commit()


# ---------- 笔记 ----------
@notes_router.get("", response_model=List[schemas.NoteOut])
def list_notes(paper_id: Optional[int] = None, db: Session = Depends(get_db)):
    stmt = select(models.Note)
    if paper_id is not None:
        stmt = stmt.where(models.Note.paper_id == paper_id)
    return db.execute(stmt).scalars().all()


@notes_router.put("/{paper_id}/{section_id}", response_model=schemas.NoteOut)
def upsert_note(
    paper_id: int,
    section_id: int,
    payload: schemas.NoteUpsert,
    db: Session = Depends(get_db),
):
    if not db.get(models.Paper, paper_id):
        raise HTTPException(status_code=404, detail="文献不存在")
    if not db.get(models.NoteSection, section_id):
        raise HTTPException(status_code=404, detail="分栏不存在")

    note = db.execute(
        select(models.Note).where(
            models.Note.paper_id == paper_id, models.Note.section_id == section_id
        )
    ).scalar_one_or_none()

    if note is None:
        note = models.Note(paper_id=paper_id, section_id=section_id, content=payload.content)
        db.add(note)
    else:
        note.content = payload.content

    db.commit()
    db.refresh(note)
    return note
