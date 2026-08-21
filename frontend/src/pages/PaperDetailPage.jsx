import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../api.js'
import PaperFormModal from '../components/PaperFormModal.jsx'
import SectionManagerModal from '../components/SectionManagerModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const SAVE_STATE = {
  dirty: '未保存',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}

// 把 Markdown 中的 ==文字== 渲染为 <mark> 黄色高亮（rehype 插件，作用于 HTML AST）
function rehypeHighlight() {
  function splitText(textNode) {
    const re = /==([^=]+)==/g
    const value = textNode.value
    const parts = []
    let last = 0
    let match
    while ((match = re.exec(value))) {
      if (match.index > last) {
        parts.push({ type: 'text', value: value.slice(last, match.index) })
      }
      parts.push({
        type: 'element',
        tagName: 'mark',
        properties: {},
        children: [{ type: 'text', value: match[1] }],
      })
      last = match.index + match[0].length
    }
    if (last < value.length) {
      parts.push({ type: 'text', value: value.slice(last) })
    }
    return parts
  }

  function walk(node) {
    if (!node.children) return
    const next = []
    for (const child of node.children) {
      if (child.type === 'text' && child.value.includes('==')) {
        next.push(...splitText(child))
      } else {
        next.push(child)
        walk(child)
      }
    }
    node.children = next
  }

  return walk
}

export default function PaperDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paper, setPaper] = useState(null)
  const [sections, setSections] = useState([])
  const [drafts, setDrafts] = useState({})
  const [saved, setSaved] = useState({})
  const [noteMode, setNoteMode] = useState('preview') // 'edit' | 'preview'
  const [editing, setEditing] = useState(false)
  const [managing, setManaging] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const timers = useRef({})
  const draftsRef = useRef({})

  async function loadAll() {
    const [p, secs, notes] = await Promise.all([
      api.getPaper(id),
      api.listSections(),
      api.listNotes(id),
    ])
    setPaper(p)
    setSections(secs)
    const d = {}
    notes.forEach((n) => {
      d[n.section_id] = n.content
    })
    setDrafts(d)
    draftsRef.current = d
  }

  async function loadPaper() {
    setPaper(await api.getPaper(id))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 离开页面 / 切换文献时，flush 尚未触发的自动保存，避免丢字
  useEffect(() => {
    return () => {
      Object.entries(timers.current).forEach(([sid, t]) => {
        clearTimeout(t)
        api.upsertNote(id, sid, draftsRef.current[sid])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function save(sectionId, content) {
    setSaved((prev) => ({ ...prev, [sectionId]: 'saving' }))
    api
      .upsertNote(id, sectionId, content)
      .then(() => setSaved((prev) => ({ ...prev, [sectionId]: 'saved' })))
      .catch(() => setSaved((prev) => ({ ...prev, [sectionId]: 'error' })))
  }

  function onChange(sectionId, value) {
    setDrafts((prev) => ({ ...prev, [sectionId]: value }))
    draftsRef.current[sectionId] = value
    setSaved((prev) => ({ ...prev, [sectionId]: 'dirty' }))
    clearTimeout(timers.current[sectionId])
    timers.current[sectionId] = setTimeout(() => save(sectionId, value), 600)
  }

  function onBlur(sectionId) {
    if (timers.current[sectionId]) {
      clearTimeout(timers.current[sectionId])
      delete timers.current[sectionId]
      save(sectionId, draftsRef.current[sectionId])
    }
  }

  // 显式 flush 所有未决保存（打开分栏管理前调用，确保 loadAll 不丢字）
  async function flushPending() {
    const tasks = Object.entries(timers.current).map(([sid, t]) => {
      clearTimeout(t)
      delete timers.current[sid]
      return api.upsertNote(id, sid, draftsRef.current[sid])
    })
    await Promise.all(tasks)
  }

  async function onUploadPdf(e) {
    const file = e.target.files[0]
    if (!file) return
    await api.uploadPdf(id, file)
    loadPaper()
  }

  function openPdf() {
    window.open(`/api/papers/${id}/pdf`, '_blank', 'noopener')
  }

  async function onDelete() {
    await api.deletePaper(id)
    navigate('/')
  }

  if (!paper) return <div className="loading">加载中…</div>

  return (
    <div className="main">
      <div className="detail-header">
        <div>
          <h1>{paper.title}</h1>
          {paper.authors && <div className="meta-line">{paper.authors}</div>}
          <div className="meta-line">
            {[paper.year, paper.venue].filter(Boolean).join(' · ')}
            {paper.doi && <span> · DOI: {paper.doi}</span>}
            {paper.arxiv_id && <span> · arXiv: {paper.arxiv_id}</span>}
          </div>
          {paper.tags.length > 0 && (
            <div className="meta-line" style={{ marginTop: 6 }}>
              <span className="muted">关键词：</span>
              {paper.tags.map((t) => (
                <span key={t.id} className="chip">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="detail-actions">
          <button className="btn" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            删除
          </button>
          <Link to="/" className="btn">
            返回
          </Link>
        </div>
      </div>

      {paper.abstract && (
        <div className="section-card" style={{ padding: '14px 16px' }}>
          <strong>摘要</strong>
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>{paper.abstract}</div>
        </div>
      )}

      <div className="section-card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong>PDF</strong>
          {paper.pdf_path ? (
            <button className="btn btn-sm" onClick={openPdf}>
              打开 PDF
            </button>
          ) : (
            <span className="muted">尚未上传</span>
          )}
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            上传 PDF
            <input type="file" accept="application/pdf" hidden onChange={onUploadPdf} />
          </label>
        </div>
      </div>

      <div className="notes-head">
        <h2 style={{ margin: 0 }}>笔记</h2>
        <div className="segmented">
          <button
            type="button"
            className={noteMode === 'preview' ? 'active' : ''}
            onClick={() => setNoteMode('preview')}
          >
            预览
          </button>
          <button
            type="button"
            className={noteMode === 'edit' ? 'active' : ''}
            onClick={() => setNoteMode('edit')}
          >
            编辑
          </button>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            await flushPending()
            setManaging(true)
          }}
        >
          管理分栏
        </button>
      </div>

      {sections.map((s) => (
        <div key={s.id} className="section-card">
          <div className="head">
            <span>{s.name}</span>
            {noteMode === 'edit' && (
              <span className={`save-state ${saved[s.id] === 'saved' ? 'saved' : ''}`}>
                {SAVE_STATE[saved[s.id]] || ''}
              </span>
            )}
          </div>
          {noteMode === 'edit' ? (
            <textarea
              placeholder={`在「${s.name}」分栏写笔记（支持 Markdown）…`}
              value={drafts[s.id] ?? ''}
              onChange={(e) => onChange(s.id, e.target.value)}
              onBlur={() => onBlur(s.id)}
            />
          ) : (
            <div className="markdown-body">
              {drafts[s.id] ? (
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{drafts[s.id]}</ReactMarkdown>
              ) : (
                <span className="muted">（无内容）</span>
              )}
            </div>
          )}
        </div>
      ))}

      {editing && (
        <PaperFormModal
          paperId={id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            loadPaper()
          }}
        />
      )}

      {managing && (
        <SectionManagerModal
          sections={sections}
          onClose={() => setManaging(false)}
          onChanged={loadAll}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="删除文献"
          message="确认删除这篇文献及其全部笔记？此操作不可恢复。"
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
