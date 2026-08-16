import { useEffect, useState } from 'react'
import { api } from './api.js'

export default function App() {
  const [status, setStatus] = useState('…')
  const [papers, setPapers] = useState([])
  const [sections, setSections] = useState([])
  const [title, setTitle] = useState('')

  async function refresh() {
    try {
      const health = await api.health()
      setStatus(health.status)
      const [ps, ss] = await Promise.all([api.listPapers(), api.listSections()])
      setPapers(ps)
      setSections(ss)
    } catch {
      setStatus('未连接')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function addPaper(e) {
    e.preventDefault()
    if (!title.trim()) return
    await api.createPaper({ title: title.trim() })
    setTitle('')
    refresh()
  }

  return (
    <div className="app">
      <header>
        <h1>LitNote</h1>
        <span className={status === 'ok' ? 'ok' : 'err'}>后端状态: {status}</span>
      </header>

      <form onSubmit={addPaper}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新建文献标题…"
        />
        <button type="submit">添加</button>
      </form>

      <section>
        <h2>笔记分栏（{sections.length}）</h2>
        <ul>
          {sections.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>文献（{papers.length}）</h2>
        <ul>
          {papers.map((p) => (
            <li key={p.id}>
              {p.title}
              {p.year ? ` (${p.year})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
