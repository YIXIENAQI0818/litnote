import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import PaperFormModal from '../components/PaperFormModal.jsx'

const SAVE_STATE = {
  dirty: '未保存',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}

export default function PaperDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paper, setPaper] = useState(null)
  const [sections, setSections] = useState([])
  const [drafts, setDrafts] = useState({})
  const [saved, setSaved] = useState({})
  const [showPdf, setShowPdf] = useState(false)
  const [pdfSrc, setPdfSrc] = useState(null) // 本地 blob URL 或后端 URL
  const [editing, setEditing] = useState(false)
  const timers = useRef({})

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
    setPdfSrc(p.pdf_path ? `/api/papers/${id}/pdf` : null)
  }

  async function loadPaper() {
    const p = await api.getPaper(id)
    setPaper(p)
    setPdfSrc(p.pdf_path ? `/api/papers/${id}/pdf` : null)
  }

  useEffect(() => {
    loadAll()
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
    setSaved((prev) => ({ ...prev, [sectionId]: 'dirty' }))
    clearTimeout(timers.current[sectionId])
    timers.current[sectionId] = setTimeout(() => save(sectionId, value), 600)
  }

  async function onUploadPdf(e) {
    const file = e.target.files[0]
    if (!file) return
    const res = await api.uploadPdf(id, file)
    // 上传成功后直接用本地 blob 预览，避免再从后端拉一遍
    setPdfSrc(URL.createObjectURL(file))
    setPaper((prev) => ({ ...prev, pdf_path: res.pdf_path }))
    setShowPdf(true)
  }

  async function onDelete() {
    if (!window.confirm('确认删除这篇文献及其全部笔记？')) return
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
          <button className="btn btn-danger" onClick={onDelete}>
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
            <button className="btn btn-sm" onClick={() => setShowPdf((v) => !v)}>
              {showPdf ? '隐藏预览' : '预览'}
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

      {showPdf && pdfSrc && <iframe className="pdf-frame" src={pdfSrc} title="PDF 预览" />}

      <h2 style={{ margin: '20px 0 12px' }}>笔记</h2>
      {sections.map((s) => (
        <div key={s.id} className="section-card">
          <div className="head">
            <span>{s.name}</span>
            <span className={`save-state ${saved[s.id] === 'saved' ? 'saved' : ''}`}>
              {SAVE_STATE[saved[s.id]] || ''}
            </span>
          </div>
          <textarea
            placeholder={`在「${s.name}」分栏写笔记（支持 Markdown）…`}
            value={drafts[s.id] ?? ''}
            onChange={(e) => onChange(s.id, e.target.value)}
          />
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
    </div>
  )
}
