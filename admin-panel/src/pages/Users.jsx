import React, { useState } from 'react'
import { Search, Filter, MoreVertical, Edit, Ban, CheckCircle, X, UserPlus, Eye, Trash2, Key, Copy, RefreshCw } from 'lucide-react'

const initialUsers = [
    { id: '1', first_name: 'Alperen', last_name: 'Güneş', email: 'alperen@example.com', uni: 'AUZEF', dept: 'Tıp', plan: 'Premium', status: 'active', date: '21.10.2023', lastLogin: '02.03.2026' },
    { id: '2', first_name: 'Ayşe', last_name: 'Yılmaz', email: 'ayse@example.com', uni: 'Anadolu AÖF', dept: 'Eczacılık', plan: 'Free', status: 'active', date: '22.10.2023', lastLogin: '01.03.2026' },
    { id: '3', first_name: 'Kaan', last_name: 'Demir', email: 'kaan@example.com', uni: 'Atatürk AÖF', dept: 'Hemşirelik', plan: 'Premium', status: 'suspended', date: '15.09.2023', lastLogin: '20.02.2026' },
    { id: '4', first_name: 'Zeynep', last_name: 'Çelik', email: 'zeynep@example.com', uni: 'AUZEF', dept: 'Tıp', plan: 'Free', status: 'active', date: '01.11.2023', lastLogin: '02.03.2026' },
    { id: '5', first_name: 'Murat', last_name: 'Kaya', email: 'murat@example.com', uni: 'AUZEF', dept: 'Diş Hekimliği', plan: 'Premium', status: 'active', date: '11.11.2023', lastLogin: '28.02.2026' },
    { id: '6', first_name: 'Selin', last_name: 'Toprak', email: 'selin@example.com', uni: 'Anadolu AÖF', dept: 'Fizyoterapi', plan: 'Free', status: 'active', date: '05.12.2023', lastLogin: '01.03.2026' },
]

export default function UserManagement() {
    const [users, setUsers] = useState(initialUsers)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterPlan, setFilterPlan] = useState('all')
    const [showModal, setShowModal] = useState(false)
    const [editUser, setEditUser] = useState(null)
    const [showDetail, setShowDetail] = useState(null)
    const [showConfirm, setShowConfirm] = useState(null)
    const [showResetPwd, setShowResetPwd] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [copied, setCopied] = useState(false)
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', uni: 'AUZEF', dept: '', plan: 'Free', password: '' })

    const filtered = users.filter(u => {
        const matchSearch = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase())
        const matchPlan = filterPlan === 'all' || u.plan === filterPlan
        return matchSearch && matchPlan
    })

    const openAddModal = () => { setEditUser(null); setForm({ first_name: '', last_name: '', email: '', uni: 'AUZEF', dept: '', plan: 'Free', password: '' }); setShowModal(true) }
    const openEditModal = (u) => { setEditUser(u); setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, uni: u.uni, dept: u.dept, plan: u.plan, password: '' }); setShowModal(true) }

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
        let pwd = ''
        for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
        return pwd
    }

    const openResetPwd = (user) => {
        const pwd = generatePassword()
        setNewPassword(pwd)
        setShowResetPwd(user)
        setCopied(false)
    }

    const copyPassword = () => {
        navigator.clipboard.writeText(newPassword)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const saveUser = () => {
        if (!form.first_name || !form.email) return
        if (editUser) {
            setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...form } : u))
        } else {
            setUsers(prev => [...prev, { id: Date.now().toString(), ...form, status: 'active', date: new Date().toLocaleDateString('tr-TR'), lastLogin: '-' }])
        }
        setShowModal(false)
    }

    const toggleStatus = (id) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u))
    }

    const deleteUser = (id) => { setUsers(prev => prev.filter(u => u.id !== id)); setShowConfirm(null) }

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h1 className="text-2xl font-black">Kullanıcı Yönetimi</h1>
                <button onClick={openAddModal} className="btn-primary flex items-center gap-2"><UserPlus size={18} /> Yeni Kullanıcı Ekle</button>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="İsim veya E-posta ara..." className="bg-dark/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary w-64 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        {['all', 'Premium', 'Free'].map(p => (
                            <button key={p} onClick={() => setFilterPlan(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterPlan === p ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                {p === 'all' ? 'Tümü' : p}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                                <th className="p-4 font-semibold">Kullanıcı</th>
                                <th className="p-4 font-semibold">Üniversite</th>
                                <th className="p-4 font-semibold">Bölüm</th>
                                <th className="p-4 font-semibold">Plan</th>
                                <th className="p-4 font-semibold">Durum</th>
                                <th className="p-4 font-semibold">Kayıt</th>
                                <th className="p-4 font-semibold text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {filtered.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-inner">{user.first_name.charAt(0)}</div>
                                            <div>
                                                <div className="font-bold text-sm">{user.first_name} {user.last_name}</div>
                                                <div className="text-xs text-gray-400">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-300">{user.uni}</td>
                                    <td className="p-4 text-sm text-gray-300">{user.dept}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 text-[10px] uppercase font-black tracking-wider rounded-md ${user.plan === 'Premium' ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/10 text-gray-300'}`}>{user.plan}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 text-sm font-semibold ${user.status === 'active' ? 'text-secondary' : 'text-danger'}`}>
                                            {user.status === 'active' ? <CheckCircle size={14} /> : <Ban size={14} />}
                                            {user.status === 'active' ? 'Aktif' : 'Askıda'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400 font-mono">{user.date}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setShowDetail(user)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Detay"><Eye size={16} /></button>
                                            <button onClick={() => openEditModal(user)} className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors" title="Düzenle"><Edit size={16} /></button>
                                            <button onClick={() => toggleStatus(user.id)} className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors" title={user.status === 'active' ? 'Askıya Al' : 'Aktifleştir'}>{user.status === 'active' ? <Ban size={16} /> : <CheckCircle size={16} />}</button>
                                            <button onClick={() => setShowConfirm(user)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
                    <div>Toplam {filtered.length} kullanıcı gösteriliyor.</div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="glass-card p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black">{editUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-1 block">Ad</label>
                                    <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-1 block">Soyad</label>
                                    <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">E-posta</label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder="ornek@email.com" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">{editUser ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre'}</label>
                                <div className="flex gap-2">
                                    <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="flex-1 bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary font-mono" placeholder={editUser ? '••••••••' : 'Şifre oluşturun'} />
                                    <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="px-3 py-2.5 bg-primary/20 text-primary rounded-xl hover:bg-primary/30 transition-colors flex items-center gap-1.5 text-xs font-bold flex-shrink-0">
                                        <RefreshCw size={14} /> Oluştur
                                    </button>
                                </div>
                                {!editUser && <p className="text-[11px] text-gray-500 mt-1">En az 6 karakter. "Oluştur" ile rastgele güçlü şifre oluşturulur.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-1 block">Üniversite</label>
                                    <select value={form.uni} onChange={e => setForm({ ...form, uni: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
                                        <option value="AUZEF">AUZEF</option>
                                        <option value="Anadolu AÖF">Anadolu AÖF</option>
                                        <option value="Atatürk AÖF">Atatürk AÖF</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-1 block">Bölüm</label>
                                    <input value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">Plan</label>
                                <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary">
                                    <option value="Free">Ücretsiz</option>
                                    <option value="Premium">Premium</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={saveUser} className="btn-primary flex-1">{editUser ? 'Güncelle' : 'Ekle'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
                    <div className="glass-card p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black">Kullanıcı Detayı</h2>
                            <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-black">{showDetail.first_name.charAt(0)}</div>
                            <div>
                                <div className="text-lg font-bold">{showDetail.first_name} {showDetail.last_name}</div>
                                <div className="text-sm text-gray-400">{showDetail.email}</div>
                            </div>
                        </div>
                        <div className="space-y-3 text-sm">
                            {[
                                ['Üniversite', showDetail.uni], ['Bölüm', showDetail.dept], ['Plan', showDetail.plan],
                                ['Durum', showDetail.status === 'active' ? 'Aktif' : 'Askıda'], ['Kayıt Tarihi', showDetail.date], ['Son Giriş', showDetail.lastLogin]
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between py-2 border-b border-white/5">
                                    <span className="text-gray-400">{k}</span>
                                    <span className="font-bold">{v}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowDetail(null)} className="btn-ghost flex-1">Kapat</button>
                            <button onClick={() => { setShowDetail(null); openResetPwd(showDetail) }} className="bg-warning/20 text-warning px-5 py-2.5 rounded-xl font-bold hover:bg-warning/30 transition-all flex-1 flex items-center justify-center gap-2"><Key size={16} /> Şifre Sıfırla</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-8 w-full max-w-sm text-center">
                        <Trash2 size={40} className="text-danger mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">Kullanıcıyı Sil</h3>
                        <p className="text-gray-400 text-sm mb-6"><strong>{showConfirm.first_name} {showConfirm.last_name}</strong> kullanıcısını silmek istediğinize emin misiniz?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(null)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={() => deleteUser(showConfirm.id)} className="bg-danger text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-600 transition-all flex-1">Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPwd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-8 w-full max-w-sm text-center">
                        <Key size={40} className="text-warning mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">Şifre Sıfırla</h3>
                        <p className="text-gray-400 text-sm mb-4"><strong>{showResetPwd.first_name} {showResetPwd.last_name}</strong> için yeni şifre:</p>
                        <div className="bg-dark/60 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg flex items-center justify-between mb-4">
                            <span className="text-secondary">{newPassword}</span>
                            <button onClick={copyPassword} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                {copied ? <CheckCircle size={18} className="text-secondary" /> : <Copy size={18} />}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-4">Bu şifreyi kullanıcıya iletmeniz gerekmektedir.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowResetPwd(null)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={() => { setShowResetPwd(null) }} className="bg-warning text-dark px-5 py-2.5 rounded-xl font-bold hover:bg-yellow-400 transition-all flex-1">Şifreyi Uygula</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
