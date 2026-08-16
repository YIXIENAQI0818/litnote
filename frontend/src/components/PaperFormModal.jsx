import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import SearchSelect from '../components/SearchSelect.jsx'

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

// 计算文件夹完整路径（如 "lyt / 1"），用于下拉框展示层级
function folderPath(folder, folders) {
  const parts = [folder.name]
  let cur = folder
  let guard = 0
  while (cur.parent_id != null && guard++ < 20) {
    const p = folders.find((f) => f.id === cur.parent_id)
    if (!p) break
    parts.unshift(p.name)
    cur = p
  }
  return parts.join(' / ')
}

// paperId 为 null 表示新建，否则为编辑
export default function PaperFormModal({ paperId, onClose, onSaved }) {
  const isEdit = paperId != null
  const [form, setForm] = useState(EMPTY)
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [fetchNote, setFetchNote] = useState('')
  const [pendingFolders, setPendingFolders] = useState([]) // 本次新建的文件夹（临时负数 id）
  const [pendingTags, setPendingTags] = useState([]) // 本次新建的关键词（临时负数 id）
  const tempIdRef = useRef(-1)

  async function loadFoldersTags() {
    const [fs, ts] = await Promise.all([api.listFolders(), api.listTags()])
    setFolders(fs)
    setTags(ts)
  }

  useEffect(() => {
    loadFoldersTags()
    if (isEdit) {
      api.getPaper(paperId).then((p) =>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, isEdit])

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleFetch() {
    const id = identifier.trim()
    if (!id) return
    setFetching(true)
    setFetchError('')
    setFetchNote('')
    try {
      const m = await api.fetchMetadata(id)
      setForm((prev) => ({
        ...prev,
        title: m.title || prev.title,
        authors: m.authors || prev.authors,
        year: m.year == null ? prev.year : String(m.year),
        venue: m.venue || prev.venue,
        doi: m.doi || prev.doi,
        arxiv_id: m.arxiv_id || prev.arxiv_id,
        abstract: m.abstract || prev.abstract,
      }))
      setFetchNote(
        m.arxiv_id
          ? '✓ 已抓取元数据，保存后将自动从 arXiv 下载 PDF'
          : '✓ 已抓取元数据（DOI 仅提供元数据，PDF 需手动上传）'
      )
    } catch (e) {
      setFetchError(e.message)
    } finally {
      setFetching(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('标题不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      // 先落盘本次新建的关键词/文件夹（延迟提交），临时负数 id 映射为真实 id
      const idMap = new Map()
      for (const t of pendingTags) {
        if (form.tag_ids.includes(t.id)) {
          const real = await api.createTag({ name: t.name })
          idMap.set(t.id, real.id)
        }
      }
      let folderId = form.folder_id === '' ? null : Number(form.folder_id)
      for (const f of pendingFolders) {
        if (folderId === f.id) {
          const real = await api.createFolder({ name: f.name, parent_id: null })
          folderId = real.id
        }
      }

      const payload = {
        title: form.title.trim(),
        authors: form.authors,
        venue: form.venue,
        doi: form.doi,
        arxiv_id: form.arxiv_id,
        abstract: form.abstract,
        year: form.year === '' ? null : Number(form.year),
        folder_id: folderId,
        tag_ids: form.tag_ids.map((id) => idMap.get(id) ?? id),
      }
      let paperIdRes
      if (isEdit) {
        await api.updatePaper(paperId, payload)
        paperIdRes = paperId
      } else {
        const created = await api.createPaper(payload)
        paperIdRes = created.id
      }
      if (file) {
        await api.uploadPdf(paperIdRes, file)
      } else if (form.arxiv_id.trim()) {
        try {
          await api.fetchPdf(paperIdRes) // 自动从 arXiv 下载 PDF
        } catch (e) {
          alert(`已保存文献，但自动下载 PDF 失败：${e.message}，可稍后手动上传`)
        }
      }
      onSaved(paperIdRes)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? '编辑文献' : '新建文献'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="fetch-box">
            <label>自动补全元数据（DOI / arXiv）</label>
            <div className="select-row">
              <input
                value={identifier}
                placeholder="如 10.1038/nature12373 或 1706.03762"
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleFetch()
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleFetch}
                disabled={fetching}
              >
                {fetching ? '抓取中…' : '抓取'}
              </button>
            </div>
            {fetchError && (
              <div style={{ color: 'var(--danger)', marginTop: 4, fontSize: 12 }}>
                {fetchError}
              </div>
            )}
            {!fetchError && fetchNote && (
              <div style={{ color: '#1a7f37', marginTop: 4, fontSize: 12 }}>{fetchNote}</div>
            )}
          </div>

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
              <SearchSelect
                options={[
                  ...folders.map((f) => ({ id: f.id, label: folderPath(f, folders) })),
                  ...pendingFolders.map((f) => ({ id: f.id, label: f.name })),
                ]}
                value={form.folder_id === '' ? null : Number(form.folder_id)}
                onChange={(v) => set('folder_id', v == null ? '' : String(v))}
                placeholder="（无）"
                onCreate={async (name) => {
                  const tempId = tempIdRef.current--
                  setPendingFolders((prev) => [...prev, { id: tempId, name }])
                  return tempId
                }}
                createLabel="新建文件夹"
                createPlaceholder="文件夹名"
              />
            </div>

            <div className="form-field full">
              <label>关键词（标签）</label>
              <SearchSelect
                multiple
                options={[
                  ...tags.map((t) => ({ id: t.id, label: t.name })),
                  ...pendingTags.map((t) => ({ id: t.id, label: t.name })),
                ]}
                value={form.tag_ids}
                onChange={(v) => set('tag_ids', v)}
                placeholder="选择关键词…"
                onCreate={async (name) => {
                  if (
                    tags.some((t) => t.name === name) ||
                    pendingTags.some((t) => t.name === name)
                  ) {
                    alert('关键词已存在')
                    return null
                  }
                  const tempId = tempIdRef.current--
                  setPendingTags((prev) => [...prev, { id: tempId, name }])
                  return tempId
                }}
                createLabel="新建关键词"
                createPlaceholder="关键词名"
              />
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
              {isEdit && (
                <span className="muted" style={{ fontSize: 12 }}>
                  留空则保留现有 PDF
                </span>
              )}
            </div>
          </div>

          {error && <div style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
