"""文件夹（树状层级）相关路由。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=List[schemas.FolderOut])
def list_folders(db: Session = Depends(get_db)):
    return (
        db.execute(select(models.Folder).order_by(models.Folder.name)).scalars().all()
    )


@router.post("", response_model=schemas.FolderOut, status_code=201)
def create_folder(payload: schemas.FolderCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(models.Folder).where(
            models.Folder.name == payload.name,
            models.Folder.parent_id == payload.parent_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="同级文件夹已存在")
    folder = models.Folder(name=payload.name, parent_id=payload.parent_id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.put("/{folder_id}", response_model=schemas.FolderOut)
def update_folder(
    folder_id: int, payload: schemas.FolderUpdate, db: Session = Depends(get_db)
):
    folder = db.get(models.Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name is not None and new_name != folder.name:
        existing = db.execute(
            select(models.Folder).where(
                models.Folder.name == new_name,
                models.Folder.parent_id == folder.parent_id,
                models.Folder.id != folder_id,
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="同级文件夹已存在")
    for key, value in data.items():
        setattr(folder, key, value)
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.get(models.Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    child_count = db.scalar(
        select(func.count()).select_from(models.Folder).where(
            models.Folder.parent_id == folder_id
        )
    )
    paper_count = db.scalar(
        select(func.count()).select_from(models.Paper).where(
            models.Paper.folder_id == folder_id
        )
    )
    if child_count or paper_count:
        raise HTTPException(status_code=400, detail="文件夹非空，无法删除")

    db.delete(folder)
    db.commit()
