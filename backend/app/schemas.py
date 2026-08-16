"""Pydantic 请求/响应模型。"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Folder ----------
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: Optional[int] = None


# ---------- Tag ----------
class TagCreate(BaseModel):
    name: str
    color: str = ""


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str


# ---------- Paper ----------
class PaperCreate(BaseModel):
    title: str
    authors: str = ""
    year: Optional[int] = None
    venue: str = ""
    doi: str = ""
    arxiv_id: str = ""
    abstract: str = ""
    folder_id: Optional[int] = None
    tag_ids: List[int] = Field(default_factory=list)


class PaperUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    abstract: Optional[str] = None
    folder_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class PaperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    authors: str
    year: Optional[int]
    venue: str
    doi: str
    arxiv_id: str
    abstract: str
    pdf_path: str
    folder_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    folder: Optional[FolderOut] = None
    tags: List[TagOut] = Field(default_factory=list)


# ---------- NoteSection ----------
class NoteSectionCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_default: bool = True


class NoteSectionUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_default: Optional[bool] = None


class NoteSectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int
    is_default: bool


# ---------- Note ----------
class NoteUpsert(BaseModel):
    content: str


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    paper_id: int
    section_id: int
    content: str
    updated_at: datetime
