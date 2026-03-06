import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, DownloadCloud, Mail, Settings, LogOut } from 'lucide-react'
import axios from 'axios'

// Import pages
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/Users'
import Subscriptions from './pages/Subscriptions'
import Scraper from './pages/Scraper'
import Messages from './pages/Messages'
import SettingsPage from './pages/Settings'

// Simple Admin Login
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post('/api/login', { email, password })
      if (data.user?.role !== 'admin') {
        setError('Bu hesap admin yetkisine sahip değil.')
        return
      }
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('admin_user', JSON.stringify(data.user))
      onLogin(data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="bg-dark-2 rounded-2xl border border-white/10 p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/admin/logo-transparent.png?v=3" alt="Logo" className="w-12 h-12 object-contain" />
          <div>
            <div className="font-bold text-xl leading-tight">Açık ve Uzaktan<br />Akademi</div>
            <div className="text-xs text-primary font-mono tracking-widest uppercase mt-1">Admin Panel</div>
          </div>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Admin E-posta" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Şifre" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

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

function AdminLayout({ children, user, onLogout }) {
  return (
    <div className="flex h-screen bg-dark">
      <aside className="w-64 border-r border-white/10 bg-dark-2 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/admin/logo-transparent.png?v=3" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <div className="font-bold text-lg leading-tight tracking-tight">Açık ve<br />Uzaktan Akademi</div>
              <div className="text-[10px] text-primary font-mono tracking-widest uppercase mt-1">Admin V2</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 mt-2 px-2">Ana Menü</div>
          <SidebarLink to="/" icon={LayoutDashboard}>Dashboard</SidebarLink>
          <SidebarLink to="/users" icon={Users}>Kullanıcılar</SidebarLink>
          <SidebarLink to="/subscriptions" icon={CreditCard}>Abonelikler</SidebarLink>
          <SidebarLink to="/scraper" icon={DownloadCloud}>Veri Çekme</SidebarLink>

          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 mt-6 px-2">Sistem</div>
          <SidebarLink to="/messages" icon={Mail}>İletişim Formları</SidebarLink>
          <SidebarLink to="/settings" icon={Settings}>Ayarlar</SidebarLink>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-400 hover:bg-red-400/10 transition-all font-semibold text-sm">
            <LogOut size={20} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-dark">
        <header className="h-16 border-b border-white/10 bg-dark-2/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="text-gray-400 text-sm">Hoş geldiniz, <strong className="text-white">{user?.first_name || 'Admin'}</strong></div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
              {(user?.first_name || 'A')[0].toUpperCase()}
            </div>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    const stored = localStorage.getItem('admin_user')
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch { }
    }
    setChecking(false)
  }, [])

  function handleLogin(u) { setUser(u) }

  function handleLogout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    setUser(null)
  }

  if (checking) return null
  if (!user) return <AdminLogin onLogin={handleLogin} />

  return (
    <Router basename="/admin">
      <AdminLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AdminLayout>
    </Router>
  )
}

export default App
