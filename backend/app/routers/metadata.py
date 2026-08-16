"""文献元数据自动抓取：DOI → CrossRef，arXiv ID → arXiv API。"""

import re
import xml.etree.ElementTree as ET
from typing import Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/metadata", tags=["metadata"])

# CrossRef / arXiv 建议携带可联系的 UA
USER_AGENT = "LitNote/0.1 (mailto:1663842668@qq.com)"

ATOM_NS = {"a": "http://www.w3.org/2005/Atom"}
ARXIV_NS = {"arxiv": "http://arxiv.org/schemas/atom"}

DOI_RE = re.compile(r"^10\.\d{4,9}/", re.IGNORECASE)
ARXIV_RE = re.compile(r"^\d{4}\.\d{4,5}(v\d+)?$")
ARXIV_OLD_RE = re.compile(r"^[a-z-]+(?:\.\w+)?/\d{7}(v\d+)?$")


class MetadataFetch(BaseModel):
    identifier: str


class MetadataOut(BaseModel):
    title: str = ""
    authors: str = ""
    year: Optional[int] = None
    venue: str = ""
    doi: str = ""
    arxiv_id: str = ""
    abstract: str = ""


def _clean_abstract(raw: str) -> str:
    """CrossRef 摘要常带 <jats:p> 等标签，去掉后合并空白。"""
    raw = re.sub(r"<[^>]+>", " ", raw or "")
    return re.sub(r"\s+", " ", raw).strip()


def _arxiv_id(raw: str) -> str:
    """从 'http://arxiv.org/abs/1706.03762v7' 之类取主体 id。"""
    m = re.search(r"(\d{4}\.\d{4,5}|[a-z-]+/\d{7})", raw or "")
    return m.group(1) if m else (raw or "")


async def _get(url: str) -> httpx.Response:
    """直连（绕过本机 SOCKS 代理），统一错误处理。"""
    try:
        async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=True) as client:
            return await client.get(url, headers={"User-Agent": USER_AGENT})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"请求上游服务失败：{e}")


async def _fetch_crossref(doi: str) -> MetadataOut:
    url = f"https://api.crossref.org/works/{quote(doi, safe='')}"
    resp = await _get(url)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="未找到该 DOI 对应的文献")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"CrossRef 返回 {resp.status_code}")

    m = resp.json().get("message", {})
    authors = ", ".join(
        f"{a.get('given', '')} {a.get('family', '')}".strip()
        for a in m.get("author", [])
    )
    issued = m.get("issued", {}).get("date-parts", [[None]])
    year = issued[0][0] if issued and issued[0] and issued[0][0] else None
    return MetadataOut(
        title=(m.get("title") or [""])[0],
        authors=authors,
        year=year,
        venue=(m.get("container-title") or [""])[0],
        doi=doi,
        abstract=_clean_abstract(m.get("abstract") or ""),
    )


async def _fetch_arxiv(arxiv_id: str) -> MetadataOut:
    url = f"http://export.arxiv.org/api/query?id_list={quote(arxiv_id, safe='')}"
    resp = await _get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"arXiv 返回 {resp.status_code}")

    root = ET.fromstring(resp.text)
    entry = root.find(".//a:entry", ATOM_NS)
    if entry is None:
        raise HTTPException(status_code=404, detail="未找到该 arXiv ID 对应的文献")

    def et(tag: str) -> str:
        el = entry.find(f"a:{tag}", ATOM_NS)
        return (el.text or "").strip() if el is not None else ""

    authors = ", ".join(
        (a.find("a:name", ATOM_NS).text or "").strip()
        for a in entry.findall("a:author", ATOM_NS)
    )
    published = et("published")
    year = int(published[:4]) if published else None

    jref = entry.find("arxiv:journal_ref", ARXIV_NS)
    venue = (jref.text or "").strip() if jref is not None and jref.text else "arXiv preprint"

    return MetadataOut(
        title=et("title"),
        authors=authors,
        year=year,
        venue=venue,
        arxiv_id=_arxiv_id(et("id")),
        abstract=et("summary"),
    )


@router.post("/fetch", response_model=MetadataOut)
async def fetch_metadata(payload: MetadataFetch):
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="请输入 DOI 或 arXiv 号")

    # 去掉常见 URL / 前缀
    identifier = re.sub(r"^https?://(dx\.)?doi\.org/", "", identifier, flags=re.IGNORECASE)
    identifier = re.sub(r"^https?://arxiv\.org/(abs|pdf)/", "", identifier, flags=re.IGNORECASE)
    identifier = re.sub(r"^arxiv:\s*", "", identifier, flags=re.IGNORECASE).strip()

    if DOI_RE.match(identifier):
        return await _fetch_crossref(identifier)
    if ARXIV_RE.match(identifier) or ARXIV_OLD_RE.match(identifier):
        return await _fetch_arxiv(identifier)
    raise HTTPException(status_code=400, detail="无法识别的标识符，请输入 DOI 或 arXiv 号")
