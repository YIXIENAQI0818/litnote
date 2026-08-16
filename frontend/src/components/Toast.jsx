import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

let toastSeq = 0

// 全局卡片式提示（替代浏览器 alert），顶部居中，自动消失
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((type, message) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const error = useCallback((message) => push('error', message), [push])
  const success = useCallback((message) => push('success', message), [push])
  const info = useCallback((message) => push('info', message), [push])

  return (
    <ToastContext.Provider value={{ error, success, info }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
