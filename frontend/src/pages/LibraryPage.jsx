import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

// 由扁平文件夹列表构建树
function buildTree(folders) {
  const map = {}
  folders.forEach((f) => {
    map[f.id] = { ...f, children: [] }
  })
  const roots = []
  folders.forEach((f) => {
    if (f.parent_id != null && map[f.parent_id]) {
      map[f.parent_id].children.push(map[f.id])
    } else {
      roots.push(map[f.id])
    }
  })
  return roots
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    const r = findNode(n.children, id)
    if (r) return r
  }
  return null
}

function collectIds(node, acc) {
  acc.add(node.id)
  node.children.forEach((c) => collectIds(c, acc))
}

function FolderNode({ node, depth, selectedId, onSelect, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false)
  return (
    <div>
      <div
        className={`row ${selectedId === node.id ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node.id)}
      >
        <span className="name">{node.name}</span>
        <span className="ops">
          <button
            title="新建子文件夹"
            onClick={(e) => {
              e.stopPropagation()
              setAdding(true)
            }}
          >
            +
          </button>
          <button
            title="删除"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node.id)
            }}
          >
            ×
          </button>
        </span>
      </div>
      {adding && (
        <div className="inline-form" style={{ paddingLeft: (depth + 1) * 16 + 8 }}>
          <input
            autoFocus
            placeholder="子文件夹名"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                onCreate(e.target.value.trim(), node.id)
                setAdding(false)
              }
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </div>
      )}
      {node.children.map((c) => (
        <FolderNode
          key={c.id}
          node={c}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default function LibraryPage() {
  const [papers, setPapers] = useState([])
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [folderId, setFolderId] = useState(null)
  const [tagId, setTagId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingRoot, setAddingRoot] = useState(false)
  const [addingTag, setAddingTag] = useState(false)

  async function refresh() {
    const [ps, fs, ts] = await Promise.all([
      api.listPapers(),
      api.listFolders(),
      api.listTags(),
    ])
    setPapers(ps)
    setFolders(fs)
    setTags(ts)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const tree = useMemo(() => buildTree(folders), [folders])

  const folderIds = useMemo(() => {
    if (folderId == null) return null
    const node = findNode(tree, folderId)
    if (!node) return new Set([folderId])
    const ids = new Set()
    collectIds(node, ids)
    return ids
  }, [folderId, tree])

  const years = useMemo(() => {
    const s = new Set()
    papers.forEach((p) => {
      if (p.year) s.add(p.year)
    })
    return [...s].sort((a, b) => b - a)
  }, [papers])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return papers.filter((p) => {
      if (folderIds && !(p.folder_id != null && folderIds.has(p.folder_id))) return false
      if (tagId != null && !p.tags.some((t) => t.id === tagId)) return false
      if (year && p.year !== Number(year)) return false
      if (needle) {
        const hay = `${p.title} ${p.authors} ${p.abstract} ${p.venue}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [papers, folderIds, tagId, year, q])

  async function createFolder(name, parentId) {
    await api.createFolder({ name, parent_id: parentId ?? null })
    refresh()
  }

  async function deleteFolder(id) {
    try {
      await api.deleteFolder(id)
      refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  async function createTag(name) {
    try {
      await api.createTag({ name })
      refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  async function deleteTag(id) {
    await api.deleteTag(id)
    refresh()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h3>文献库</h3>
        <div
          className={`row ${folderId == null && tagId == null ? 'active' : ''}`}
          onClick={() => {
            setFolderId(null)
            setTagId(null)
          }}
        >
          <span className="name">全部文献</span>
        </div>

        <h3>
          文件夹
          <button
            className="btn btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => setAddingRoot(true)}
          >
            +
          </button>
        </h3>
        {addingRoot && (
          <div className="inline-form">
            <input
              autoFocus
              placeholder="文件夹名"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  createFolder(e.target.value.trim(), null)
                  setAddingRoot(false)
                }
                if (e.key === 'Escape') setAddingRoot(false)
              }}
            />
          </div>
        )}
        {tree.map((n) => (
          <FolderNode
            key={n.id}
            node={n}
            depth={0}
            selectedId={folderId}
            onSelect={(id) => {
              setFolderId(id)
              setTagId(null)
            }}
            onCreate={createFolder}
            onDelete={deleteFolder}
          />
        ))}

        <h3>
          标签
          <button
            className="btn btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => setAddingTag(true)}
          >
            +
          </button>
        </h3>
        {addingTag && (
          <div className="inline-form">
            <input
              autoFocus
              placeholder="标签名"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  createTag(e.target.value.trim())
                  setAddingTag(false)
                }
                if (e.key === 'Escape') setAddingTag(false)
              }}
            />
          </div>
        )}
        {tags.map((t) => (
          <div
            key={t.id}
            className={`row ${tagId === t.id ? 'active' : ''}`}
            onClick={() => {
              setTagId(t.id)
              setFolderId(null)
            }}
          >
            <span className="name">{t.name}</span>
            <span className="ops">
              <button
                title="删除"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteTag(t.id)
                }}
              >
                ×
              </button>
            </span>
          </div>
        ))}
      </aside>

      <main className="main">
        <div className="toolbar">
          <input
            className="search"
            placeholder="搜索标题 / 作者 / 摘要 / 会议…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">全部年份</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Link to="/papers/new" className="btn btn-primary">
            ＋ 新建文献
          </Link>
        </div>

        {loading ? (
          <div className="loading">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">没有匹配的文献</div>
        ) : (
          <div className="paper-list">
            {filtered.map((p) => (
              <Link key={p.id} to={`/papers/${p.id}`} className="paper-card">
                <div className="title">{p.title}</div>
                <div className="meta">
                  {p.authors && `${p.authors} · `}
                  {p.year && `${p.year} · `}
                  {p.venue}
                </div>
                {p.tags.length > 0 && (
                  <div>
                    {p.tags.map((t) => (
                      <span key={t.id} className="chip">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {p.abstract && <div className="abstract">{p.abstract}</div>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
