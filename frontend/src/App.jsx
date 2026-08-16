import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage.jsx'
import PaperDetailPage from './pages/PaperDetailPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/papers/:id" element={<PaperDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}
