import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'

const EMPTY = {
  title: '',
  authors: '',
  year: '',
  venue: '',
  doi: '',
  arxiv_id: '',
  abstract: '',
  folder_id: '',
  tag_ids: [],
}

function folderDepth(folder, folders) {
  let d = 0
  let cur = folder
  while (cur.parent_id != null) {
    const p = folders.find((f) => f.id === cur.parent_id)
    if (!p) break
    cur = p
    d += 1
  }
  return d
}

export default function PaperFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listFolders().then(setFolders)
    api.listTags().then(setTags)
    if (isEdit) {
      api.getPaper(id).then((p) =>
        setForm({
          title: p.title,
          authors: p.authors,
          year: p.year == null ? '' : String(p.year),
          venue: p.venue,
          doi: p.doi,
          arxiv_id: p.arxiv_id,
          abstract: p.abstract,
          folder_id: p.folder_id == null ? '' : String(p.folder_id),
          tag_ids: p.tags.map((t) => t.id),
        })
      )
    }
  }, [id, isEdit])

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((x) => x !== tagId)
        : [...prev.tag_ids, tagId],
    }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('标题不能为空')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      title: form.title.trim(),
      authors: form.authors,
      venue: form.venue,
      doi: form.doi,
      arxiv_id: form.arxiv_id,
      abstract: form.abstract,
      year: form.year === '' ? null : Number(form.year),
      folder_id: form.folder_id === '' ? null : Number(form.folder_id),
      tag_ids: form.tag_ids,
    }
    try {
      let paperId
      if (isEdit) {
        await api.updatePaper(id, payload)
        paperId = id
      } else {
        const created = await api.createPaper(payload)
        paperId = created.id
      }
      if (file) await api.uploadPdf(paperId, file)
      navigate(`/papers/${paperId}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="form-page">
      <h1>{isEdit ? '编辑文献' : '新建文献'}</h1>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="form-field full">
            <label>标题 *</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-field full">
            <label>作者</label>
            <input
              value={form.authors}
              onChange={(e) => set('authors', e.target.value)}
              placeholder="多个作者用逗号分隔"
            />
          </div>
          <div className="form-field">
            <label>年份</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
              placeholder="2024"
            />
          </div>
          <div className="form-field">
            <label>会议 / 期刊</label>
            <input
              value={form.venue}
              onChange={(e) => set('venue', e.target.value)}
              placeholder="NeurIPS / Nature…"
            />
          </div>
          <div className="form-field">
            <label>DOI</label>
            <input
              value={form.doi}
              onChange={(e) => set('doi', e.target.value)}
              placeholder="10.xxxx/xxxxx"
            />
          </div>
          <div className="form-field">
            <label>arXiv ID</label>
            <input
              value={form.arxiv_id}
              onChange={(e) => set('arxiv_id', e.target.value)}
              placeholder="2401.xxxxx"
            />
          </div>
          <div className="form-field full">
            <label>文件夹</label>
            <select value={form.folder_id} onChange={(e) => set('folder_id', e.target.value)}>
              <option value="">（无）</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {'  '.repeat(folderDepth(f, folders))}
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field full">
            <label>标签</label>
            <div className="tag-picker">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className={`tag-option ${form.tag_ids.includes(t.id) ? 'selected' : ''}`}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.name}
                </span>
              ))}
              {tags.length === 0 && <span className="muted">暂无标签，可去首页侧边栏创建</span>}
            </div>
          </div>
          <div className="form-field full">
            <label>摘要</label>
            <textarea value={form.abstract} onChange={(e) => set('abstract', e.target.value)} />
          </div>
          <div className="form-field full">
            <label>PDF 文件</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            {isEdit && <span className="muted" style={{ fontSize: 12 }}>留空则保留现有 PDF</span>}
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
