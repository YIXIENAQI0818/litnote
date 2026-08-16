"""标签相关路由。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=List[schemas.TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.execute(select(models.Tag).order_by(models.Tag.name)).scalars().all()


@router.post("", response_model=schemas.TagOut, status_code=201)
def create_tag(payload: schemas.TagCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(models.Tag).where(models.Tag.name == payload.name)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="标签已存在")
    tag = models.Tag(name=payload.name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=schemas.TagOut)
def update_tag(tag_id: int, payload: schemas.TagUpdate, db: Session = Depends(get_db)):
    tag = db.get(models.Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name is not None and new_name != tag.name:
        existing = db.execute(
            select(models.Tag).where(models.Tag.name == new_name)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="标签已存在")
    for key, value in data.items():
        setattr(tag, key, value)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(models.Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    db.delete(tag)
    db.commit()
