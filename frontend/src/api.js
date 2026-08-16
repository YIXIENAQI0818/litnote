const BASE = '/api'

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const data = await res.json()
      if (data.detail) detail = data.detail
    } catch {
      /* 忽略非 JSON 错误体 */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => request('/health'),
  fetchMetadata: (identifier) =>
    request('/metadata/fetch', { method: 'POST', body: JSON.stringify({ identifier }) }),

  // ---- 文献 ----
  listPapers: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v)
    }
    const s = qs.toString()
    return request(`/papers${s ? `?${s}` : ''}`)
  },
  getPaper: (id) => request(`/papers/${id}`),
  createPaper: (data) => request('/papers', { method: 'POST', body: JSON.stringify(data) }),
  updatePaper: (id, data) => request(`/papers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePaper: (id) => request(`/papers/${id}`, { method: 'DELETE' }),
  uploadPdf: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/papers/${id}/pdf`, { method: 'POST', body: fd })
  },
  fetchPdf: (id) => request(`/papers/${id}/fetch-pdf`, { method: 'POST' }),

  // ---- 文件夹 ----
  listFolders: () => request('/folders'),
  createFolder: (data) => request('/folders', { method: 'POST', body: JSON.stringify(data) }),
  updateFolder: (id, data) => request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),

  // ---- 标签 ----
  listTags: () => request('/tags'),
  createTag: (data) => request('/tags', { method: 'POST', body: JSON.stringify(data) }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),

  // ---- 笔记分栏 ----
  listSections: () => request('/note-sections'),
  createSection: (data) => request('/note-sections', { method: 'POST', body: JSON.stringify(data) }),
  updateSection: (id, data) => request(`/note-sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSection: (id) => request(`/note-sections/${id}`, { method: 'DELETE' }),

  // ---- 笔记 ----
  listNotes: (paperId) => request(`/notes?paper_id=${paperId}`),
  upsertNote: (paperId, sectionId, content) =>
    request(`/notes/${paperId}/${sectionId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
}
