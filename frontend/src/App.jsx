import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage.jsx'
import PaperDetailPage from './pages/PaperDetailPage.jsx'
import PaperFormPage from './pages/PaperFormPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/papers/new" element={<PaperFormPage />} />
        <Route path="/papers/:id" element={<PaperDetailPage />} />
        <Route path="/papers/:id/edit" element={<PaperFormPage />} />
      </Routes>
    </BrowserRouter>
  )
}
