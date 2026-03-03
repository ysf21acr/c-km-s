import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, DownloadCloud, FileText, Mail, Settings, LogOut } from 'lucide-react'

// Import pages
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/Users'
import Subscriptions from './pages/Subscriptions'
import Scraper from './pages/Scraper'
import Content from './pages/Content'
import Messages from './pages/Messages'
import SettingsPage from './pages/Settings'

const SidebarLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${isActive ? 'bg-primary/20 text-primary border-l-4 border-primary' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-semibold text-sm">{children}</span>
    </Link>
  )
}

function AdminLayout({ children }) {
  return (
    <div className="flex h-screen bg-dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-dark-2 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#7b2fbe] flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20">
              M
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight">MedDoc</div>
              <div className="text-xs text-primary font-mono tracking-widest uppercase">Admin V2</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 mt-2 px-2">Ana Menü</div>
          <SidebarLink to="/" icon={LayoutDashboard}>Dashboard</SidebarLink>
          <SidebarLink to="/users" icon={Users}>Kullanıcılar</SidebarLink>
          <SidebarLink to="/subscriptions" icon={CreditCard}>Abonelikler</SidebarLink>
          <SidebarLink to="/scraper" icon={DownloadCloud}>Veri Çekme</SidebarLink>
          <SidebarLink to="/content" icon={FileText}>İçerik Editörü</SidebarLink>

          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 px-2">Sistem</div>
          <SidebarLink to="/messages" icon={Mail}>İletişim Formları</SidebarLink>
          <SidebarLink to="/settings" icon={Settings}>Ayarlar</SidebarLink>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-400 hover:bg-red-400/10 transition-all font-semibold text-sm">
            <LogOut size={20} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-dark">
        {/* Top Header */}
        <header className="h-16 border-b border-white/10 bg-dark-2/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="text-gray-400 text-sm">Hoş geldiniz, <strong className="text-white">Admin</strong></div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
              A
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router basename="/admin">
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/content" element={<Content />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AdminLayout>
    </Router>
  )
}

export default App
