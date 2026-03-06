import React, { useState, useEffect } from 'react'
import { Search, Edit, Ban, CheckCircle, X, UserPlus, Trash2, Key, Copy, RefreshCw } from 'lucide-react'
import api from '../api'

export default function UserManagement() {
    const [users, setUsers] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(null) // 'add' | 'edit' | 'reset'
    const [form, setForm] = useState({})
    const [universities, setUniversities] = useState([])
    const [departments, setDepartments] = useState([])
    const [generatedPwd, setGeneratedPwd] = useState('')
    const [copied, setCopied] = useState(false)

    useEffect(() => { loadUsers(); loadUniversities() }, [page])

    async function loadUsers() {
        setLoading(true)
        try {
            const { data } = await api.get('/users', { params: { page, limit: 50, search } })
            setUsers(data.data || [])
            setTotal(data.total || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function loadUniversities() {
        try {
            const { data } = await api.get('/universities')
            setUniversities(data)
        } catch (err) { console.error(err) }
    }

    async function loadDepartments(uniId) {
        if (!uniId) { setDepartments([]); return }
        try {
            const { data } = await api.get('/departments', { params: { university_id: uniId } })
            setDepartments(data)
        } catch (err) { console.error(err) }
    }

    function openAdd() {
        setForm({ email: '', password: '', first_name: '', last_name: '', plan: 'free', university_id: '', department_id: '' })
        setGeneratedPwd('')
        setDepartments([])
        setModal('add')
    }

    function openEdit(u) {
        setForm({ ...u, plan: (String(u.plan || '').toLowerCase() === 'premium') ? 'premium' : 'free', university_id: u.university_id || '', department_id: u.department_id || '' })
        if (u.university_id) loadDepartments(u.university_id)
        setModal('edit')
    }

    function openReset(u) {
        setForm(u)
        const pwd = generatePassword()
        setGeneratedPwd(pwd)
        setCopied(false)
        setModal('reset')
    }

    function generatePassword() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let pwd = ''
        for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
        return pwd
    }

    async function saveUser() {
        try {
            let response
            if (modal === 'add') {
                response = await api.post('/users', { ...form, password: form.password || generatedPwd })
            } else if (modal === 'edit') {
                response = await api.put(`/users/${form.id}`, form)
            }

            const requestedPlan = String(form.plan || 'free').toLowerCase()
            const effectivePlan = String(response?.data?.effective_plan || requestedPlan).toLowerCase()
            if (effectivePlan !== requestedPlan) {
                alert(`Plan güncellenemedi. Beklenen: ${requestedPlan}, oluşan: ${effectivePlan}`)
            }
            setModal(null)
            loadUsers()
        } catch (err) {
            alert(err.response?.data?.error || 'Hata oluştu')
        }
    }

    async function resetPassword() {
        try {
            await api.put(`/users/${form.id}/reset-password`, { new_password: generatedPwd })
            setModal(null)
            alert('Şifre başarıyla sıfırlandı!')
        } catch (err) {
            alert(err.response?.data?.error || 'Hata oluştu')
        }
    }

    async function toggleStatus(id) {
        try {
            await api.put(`/users/${id}/toggle-status`)
            loadUsers()
        } catch (err) { console.error(err) }
    }

    async function deleteUser(id) {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return
        try {
            await api.delete(`/users/${id}`)
            loadUsers()
        } catch (err) { console.error(err) }
    }

    function copyPassword() {
        navigator.clipboard.writeText(generatedPwd)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    function handleUniChange(uniId) {
        setForm(f => ({ ...f, university_id: uniId, department_id: '' }))
        loadDepartments(uniId)
    }

    const filteredUsers = users

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>
                    <p className="text-gray-400 mt-1">{total} kullanıcı</p>
                </div>
                <button onClick={openAdd} className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
                    <UserPlus size={18} /> Yeni Kullanıcı Ekle
                </button>
            </div>

            <div className="mb-6 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && loadUsers()}
                        placeholder="İsim veya e-posta ile ara..."
                        className="w-full pl-11 pr-4 py-3 bg-dark-2 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-primary focus:outline-none"
                    />
                </div>
                <button onClick={loadUsers} className="bg-dark-2 border border-white/10 px-4 py-3 rounded-xl text-gray-400 hover:text-white transition-all">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="bg-dark-2 rounded-2xl border border-white/5 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Kullanıcı</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Üniversite / Bölüm</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Plan</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Durum</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Kayıt</th>
                                <th className="text-right text-xs font-bold text-gray-500 uppercase px-6 py-4">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[.02] transition-all">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold">{u.first_name} {u.last_name}</div>
                                        <div className="text-sm text-gray-400">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">
                                        {u.university_name || '—'}
                                        {u.department_name && <><br /><span className="text-gray-400">{u.department_name}</span></>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${String(u.plan).toLowerCase() === 'premium' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'}`}>
                                            {String(u.plan).toLowerCase() === 'premium' ? 'Premium' : 'Free'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {u.is_active ? 'Aktif' : 'Askıda'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {new Date(u.created_at).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-primary transition-all" title="Düzenle">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => openReset(u)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-amber-400 transition-all" title="Şifre Sıfırla">
                                                <Key size={16} />
                                            </button>
                                            <button onClick={() => toggleStatus(u.id)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-orange-400 transition-all" title={u.is_active ? 'Askıya Al' : 'Aktif Et'}>
                                                {u.is_active ? <Ban size={16} /> : <CheckCircle size={16} />}
                                            </button>
                                            <button onClick={() => deleteUser(u.id)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-all" title="Sil">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan="6" className="text-center py-12 text-gray-400">Kullanıcı bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {(modal === 'add' || modal === 'edit') && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-dark-2 rounded-2xl border border-white/10 p-8 w-full max-w-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">{modal === 'add' ? 'Yeni Kullanıcı Ekle' : 'Kullanıcı Düzenle'}</h2>
                            <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input value={form.first_name || ''} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Ad" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                                <input value={form.last_name || ''} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Soyad" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            </div>
                            <input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-posta" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            {modal === 'add' && (
                                <input value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Şifre (min 6 karakter)" type="password" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            )}
                            <select value={form.plan || 'free'} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none">
                                <option value="free">Free</option>
                                <option value="premium">Premium</option>
                            </select>
                            <select value={form.university_id || ''} onChange={e => handleUniChange(e.target.value)} className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none">
                                <option value="">Üniversite Seçin</option>
                                {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <select value={form.department_id || ''} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" disabled={!departments.length}>
                                <option value="">Bölüm Seçin</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all">İptal</button>
                            <button onClick={saveUser} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold transition-all">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {modal === 'reset' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-dark-2 rounded-2xl border border-white/10 p-8 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">Şifre Sıfırla</h2>
                            <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <p className="text-gray-400 mb-4">{form.first_name} {form.last_name} ({form.email})</p>
                        <div className="bg-dark rounded-xl p-4 flex items-center justify-between border border-white/10">
                            <code className="text-primary font-mono text-lg">{generatedPwd}</code>
                            <div className="flex gap-2">
                                <button onClick={copyPassword} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all" title="Kopyala">
                                    <Copy size={16} />
                                </button>
                                <button onClick={() => { setGeneratedPwd(generatePassword()); setCopied(false) }} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all" title="Yenile">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                        {copied && <div className="text-emerald-400 text-sm mt-2">✓ Panoya kopyalandı</div>}
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all">İptal</button>
                            <button onClick={resetPassword} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-500/80 text-white font-semibold transition-all">Şifreyi Sıfırla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
