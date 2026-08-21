import { useEffect, useState } from 'react'
import { api } from '../api.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// 管理笔记分栏：增删、重命名、排序
export default function SectionManagerModal({ sections, onClose, onChanged }) {
  const [list, setList] = useState([])
  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    setList(sections.map((s) => ({ id: s.id, name: s.name })))
  }, [sections])

  async function add() {
    const name = newName.trim()
    if (!name) return
    const created = await api.createSection({ name, sort_order: list.length, is_default: false })
    setNewName('')
    setList((prev) => [...prev, { id: created.id, name: created.name }])
  }

  async function rename(item, value) {
    const name = value.trim()
    if (!name || name === item.name) return
    await api.updateSection(item.id, { name })
    setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, name } : x)))
  }

  async function remove(item) {
    await api.deleteSection(item.id)
    setList((prev) => prev.filter((x) => x.id !== item.id))
  }

  async function move(index, dir) {
    const j = index + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[index], next[j]] = [next[j], next[index]]
    setList(next)
    await api.updateSection(next[index].id, { sort_order: index })
    await api.updateSection(next[j].id, { sort_order: j })
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2>管理笔记分栏</h2>
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="section-manager-list">
            {list.map((item, i) => (
              <div key={item.id} className="section-manager-row">
                <span className="muted" style={{ width: 20, textAlign: 'center' }}>
                  {i + 1}
                </span>
                <input
                  defaultValue={item.name}
                  onBlur={(e) => rename(item, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur()
                  }}
                />
                <span className="row-ops">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={i === list.length - 1}
                    onClick={() => move(i, 1)}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setPendingDelete(item)}
                    title="删除"
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="inline-form" style={{ marginTop: 12 }}>
            <input
              value={newName}
              placeholder="新分栏名，如「复现方法」"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={add}>
              添加
            </button>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onChanged()
                onClose()
              }}
            >
              完成
            </button>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="删除分栏"
          message={`删除分栏「${pendingDelete.name}」？其下所有文献的该栏笔记会一并删除。`}
          onConfirm={() => {
            remove(pendingDelete)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
