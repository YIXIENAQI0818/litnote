"""SQLAlchemy ORM 模型。

数据模型（见项目 CLAUDE.md）：
    papers / folders / tags / paper_tag / note_sections / notes
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


def _utcnow() -> datetime:
    """返回 naive UTC 时间，避免 datetime.utcnow 的弃用告警。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# 文献 <-> 标签 多对多关联表
paper_tag = Table(
    "paper_tag",
    Base.metadata,
    Column("paper_id", Integer, ForeignKey("papers.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Paper(Base):
    """一篇文献。"""

    __tablename__ = "papers"

    id = Column(Integer, primary_key=True)
    title = Column(String(512), nullable=False)
    authors = Column(String(1024), default="")
    year = Column(Integer, nullable=True)
    venue = Column(String(256), default="")  # 会议/期刊
    doi = Column(String(256), default="")
    arxiv_id = Column(String(128), default="")
    abstract = Column(Text, default="")
    pdf_path = Column(String(1024), default="")  # 本地 PDF 绝对路径
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    folder = relationship("Folder", back_populates="papers")
    tags = relationship("Tag", secondary=paper_tag, back_populates="papers")
    notes = relationship("Note", back_populates="paper", cascade="all, delete-orphan")


class Folder(Base):
    """文件夹，树状层级（自引用）。"""

    __tablename__ = "folders"

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)

    parent = relationship("Folder", remote_side=[id], backref="children")
    papers = relationship("Paper", back_populates="folder")


class Tag(Base):
    """标签，与文献多对多。"""

    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), unique=True, nullable=False)
    color = Column(String(16), default="")

    papers = relationship("Paper", secondary=paper_tag, back_populates="tags")


class NoteSection(Base):
    """笔记分栏定义（可配置，如 创新点/可借鉴/结论/疑问）。"""

    __tablename__ = "note_sections"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    sort_order = Column(Integer, default=0)
    is_default = Column(Boolean, default=True)

    notes = relationship("Note", back_populates="section", cascade="all, delete-orphan")


class Note(Base):
    """一篇文献在某分栏下的一段笔记。"""

    __tablename__ = "notes"
    __table_args__ = (
        UniqueConstraint("paper_id", "section_id", name="uq_note_paper_section"),
    )

    id = Column(Integer, primary_key=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("note_sections.id"), nullable=False)
    content = Column(Text, default="")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    paper = relationship("Paper", back_populates="notes")
    section = relationship("NoteSection", back_populates="notes")
