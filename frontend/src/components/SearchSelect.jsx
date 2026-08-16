import { useEffect, useRef, useState } from 'react'

// 可搜索下拉：单选（文件夹）/ 多选（关键词），支持输入筛选与内联创建（失焦即创建）
export default function SearchSelect({
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = '请选择…',
  onCreate,
  createLabel = '新建',
  createPlaceholder = '输入名称',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const rootRef = useRef(null)
  const createDone = useRef(false)

  // 点击组件外部时收起面板
  useEffect(() => {
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedIds = multiple
    ? value || []
    : value == null || value === ''
      ? []
      : [value]

  const filtered = options.filter((o) => {
    const q = query.trim().toLowerCase()
    return !q || o.label.toLowerCase().includes(q)
  })

  function isSelected(id) {
    return selectedIds.some((x) => x === id)
  }

  function labelOf(id) {
    const o = options.find((x) => x.id === id)
    return o ? o.label : ''
  }

  function toggle(id) {
    if (multiple) {
      onChange(isSelected(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
    } else {
      onChange(id)
      setOpen(false)
      setQuery('')
    }
  }

  async function commitCreate() {
    if (createDone.current) return
    createDone.current = true
    const name = newName.trim()
    setCreating(false)
    setNewName('')
    if (name && onCreate) {
      await onCreate(name)
      if (!multiple) setOpen(false)
    }
  }

  return (
    <div className="search-select" ref={rootRef}>
      <div
        className="ss-control"
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
      >
        {multiple && selectedIds.length > 0 && (
          <span className="ss-chips">
            {selectedIds.map((id) => (
              <span key={id} className="ss-chip">
                {labelOf(id)}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(selectedIds.filter((x) => x !== id))
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </span>
        )}
        <span className={`ss-value ${selectedIds.length === 0 ? 'placeholder' : ''}`}>
          {multiple
            ? selectedIds.length === 0
              ? placeholder
              : ''
            : selectedIds.length
              ? labelOf(selectedIds[0])
              : placeholder}
        </span>
        <span className="ss-arrow">▾</span>
      </div>

      {open && (
        <div className="ss-panel">
          <input
            className="ss-search"
            autoFocus
            placeholder="搜索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ss-options">
            {filtered.length === 0 && <div className="ss-empty">无匹配项</div>}
            {filtered.map((o) => {
              const sel = isSelected(o.id)
              return (
                <div
                  key={o.id}
                  className={`ss-option ${sel ? 'selected' : ''}`}
                  onClick={() => toggle(o.id)}
                >
                  {multiple && <span className="ss-check">{sel ? '✓' : ''}</span>}
                  <span className="ss-label">{o.label}</span>
                </div>
              )
            })}
          </div>
          {onCreate && (
            <div className="ss-create">
              {creating ? (
                <input
                  autoFocus
                  placeholder={createPlaceholder}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitCreate()
                    } else if (e.key === 'Escape') {
                      createDone.current = true
                      setCreating(false)
                      setNewName('')
                    }
                  }}
                  onBlur={commitCreate}
                />
              ) : (
                <button
                  type="button"
                  className="ss-create-btn"
                  onClick={() => {
                    setCreating(true)
                    createDone.current = false
                  }}
                >
                  ＋ {createLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
