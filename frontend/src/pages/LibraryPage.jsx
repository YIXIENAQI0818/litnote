import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import PaperFormModal from '../components/PaperFormModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useToast } from '../components/Toast.jsx'

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

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
}

// 内联创建输入框：失焦/回车提交，Esc 取消，空值视为取消
function InlineCreate({ placeholder, onDone, style }) {
  const done = useRef(false)
  const [value, setValue] = useState('')

  function finish() {
    if (done.current) return
    done.current = true
    onDone(value)
  }

  return (
    <div className="inline-form" style={style}>
      <input
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish()
          } else if (e.key === 'Escape') {
            done.current = true
            onDone('')
          }
        }}
        onBlur={finish}
      />
    </div>
  )
}

// 内联改名输入框：失焦/回车提交，Esc 恢复原名
function InlineRename({ initial, onDone }) {
  const done = useRef(false)
  const [value, setValue] = useState(initial)

  function finish() {
    if (done.current) return
    done.current = true
    onDone(value)
  }

  return (
    <input
      className="rename-input"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          finish()
        } else if (e.key === 'Escape') {
          done.current = true
          onDone(initial)
        }
      }}
      onBlur={finish}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function FolderNode({ node, depth, selectedId, onSelect, onCreate, onDelete, onRename }) {
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState(false)
  return (
    <div>
      <div
        className={`row ${selectedId === node.id ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node.id)}
      >
        {renaming ? (
          <InlineRename
            initial={node.name}
            onDone={(v) => {
              setRenaming(false)
              const name = v.trim()
              if (name && name !== node.name) onRename(node.id, name)
            }}
          />
        ) : (
          <>
            <span className="name">{node.name}</span>
            <span className="ops">
              <button
                title="改名"
                onClick={(e) => {
                  e.stopPropagation()
                  setRenaming(true)
                }}
              >
                <PencilIcon />
              </button>
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
          </>
        )}
      </div>
      {adding && (
        <InlineCreate
          placeholder="子文件夹名"
          style={{ paddingLeft: (depth + 1) * 16 + 8 }}
          onDone={(value) => {
            setAdding(false)
            const name = value.trim()
            if (name) onCreate(name, node.id)
          }}
        />
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
          onRename={onRename}
        />
      ))}
    </div>
  )
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const toast = useToast()
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
  const [modal, setModal] = useState(null) // null | {type:'create'} | {type:'edit', id}
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('updated') // 'updated' | 'title' | 'year'
  const [renamingTagId, setRenamingTagId] = useState(null)
  const [confirm, setConfirm] = useState(null) // {kind:'folder'|'tag', id}

  async function refresh() {
    setError('')
    try {
      const [ps, fs, ts] = await Promise.all([
        api.listPapers(),
        api.listFolders(),
        api.listTags(),
      ])
      setPapers(ps)
      setFolders(fs)
      setTags(ts)
    } catch {
      setError('加载失败，请确认后端已启动（uvicorn app.main:app）')
    } finally {
      setLoading(false)
    }
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
        const keyword = p.tags.map((t) => t.name).join(' ')
        const hay = `${p.title} ${p.authors} ${p.abstract} ${p.venue} ${keyword}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    }).sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'zh')
      if (sortBy === 'year') return (b.year ?? 0) - (a.year ?? 0)
      return (b.updated_at || '').localeCompare(a.updated_at || '')
    })
  }, [papers, folderIds, tagId, year, q, sortBy])

  async function createFolder(name, parentId) {
    try {
      await api.createFolder({ name, parent_id: parentId ?? null })
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  function askDeleteFolder(id) {
    setConfirm({ kind: 'folder', id })
  }

  async function doDeleteFolder(id) {
    try {
      await api.deleteFolder(id)
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function createTag(name) {
    try {
      await api.createTag({ name })
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function renameFolder(id, name) {
    try {
      await api.updateFolder(id, { name })
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function renameTag(id, name) {
    try {
      await api.updateTag(id, { name })
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  function askDeleteTag(id) {
    setConfirm({ kind: 'tag', id })
  }

  async function doDeleteTag(id) {
    await api.deleteTag(id)
    refresh()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">L</span>
          <span className="brand-name">LitNote</span>
        </div>
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
          <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setAddingRoot(true)}>
            +
          </button>
        </h3>
        {addingRoot && (
          <InlineCreate
            placeholder="文件夹名"
            onDone={(value) => {
              setAddingRoot(false)
              const name = value.trim()
              if (name) createFolder(name, null)
            }}
          />
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
            onDelete={askDeleteFolder}
            onRename={renameFolder}
          />
        ))}

        <h3>
          关键词
          <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setAddingTag(true)}>
            +
          </button>
        </h3>
        {addingTag && (
          <InlineCreate
            placeholder="关键词名"
            onDone={(value) => {
              setAddingTag(false)
              const name = value.trim()
              if (name) createTag(name)
            }}
          />
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
            {renamingTagId === t.id ? (
              <InlineRename
                initial={t.name}
                onDone={(v) => {
                  setRenamingTagId(null)
                  const name = v.trim()
                  if (name && name !== t.name) renameTag(t.id, name)
                }}
              />
            ) : (
              <>
                <span className="name">{t.name}</span>
                <span className="ops">
                  <button
                    title="改名"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenamingTagId(t.id)
                    }}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation()
                      askDeleteTag(t.id)
                    }}
                  >
                    ×
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </aside>

      <main className="main">
        <div className="toolbar">
          <input
            className="search"
            placeholder="搜索标题 / 作者 / 摘要 / 关键词…"
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
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="updated">按更新时间</option>
            <option value="title">按标题</option>
            <option value="year">按年份</option>
          </select>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
            ＋ 新建文献
          </button>
        </div>

        {!loading && !error && (
          <div className="list-header">
            <span>共 {filtered.length} 篇文献</span>
          </div>
        )}

        {error ? (
          <div className="empty">
            <p>{error}</p>
            <button className="btn" onClick={refresh}>
              重试
            </button>
          </div>
        ) : loading ? (
          <div className="loading">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">没有匹配的文献</div>
        ) : (
          <div className="paper-list">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="paper-card"
                onClick={() => navigate(`/papers/${p.id}`)}
              >
                <button
                  className="gear"
                  title="编辑"
                  onClick={(e) => {
                    e.stopPropagation()
                    setModal({ type: 'edit', id: p.id })
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.04 7.04 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 9.78a.5.5 0 0 0 .12.64l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.31.61.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.09.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" />
                  </svg>
                </button>
                <div className="title">{p.title}</div>
                <div className="meta">
                  {p.authors && `${p.authors} · `}
                  {p.year && `${p.year} · `}
                  {p.venue}
                </div>
                {p.tags.length > 0 && (
                  <div className="keywords">
                    {p.tags.map((t) => (
                      <span key={t.id} className="chip">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {p.abstract && <div className="abstract">{p.abstract}</div>}
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <PaperFormModal
          paperId={modal.type === 'edit' ? modal.id : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            refresh()
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'folder' ? '删除文件夹' : '删除关键词'}
          message={
            confirm.kind === 'folder'
              ? '确认删除该文件夹？（需先清空其子文件夹与文献）'
              : '确认删除该关键词？将从所有文献上移除'
          }
          onConfirm={async () => {
            const { kind, id } = confirm
            setConfirm(null)
            if (kind === 'folder') await doDeleteFolder(id)
            else await doDeleteTag(id)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
