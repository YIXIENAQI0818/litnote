const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => request('/health'),
  listPapers: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/papers${qs ? `?${qs}` : ''}`)
  },
  listFolders: () => request('/folders'),
  listTags: () => request('/tags'),
  listSections: () => request('/note-sections'),
  createPaper: (data) =>
    request('/papers', { method: 'POST', body: JSON.stringify(data) }),
}
