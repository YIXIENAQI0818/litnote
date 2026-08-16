import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage.jsx'
import PaperDetailPage from './pages/PaperDetailPage.jsx'
import { ToastProvider } from './components/Toast.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/papers/:id" element={<PaperDetailPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
