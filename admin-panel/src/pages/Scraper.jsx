import React, { useState } from 'react'
import { Play, Pause, RefreshCw, Plus, Edit, Trash2, X, Download, AlertCircle, CheckCircle, Loader } from 'lucide-react'

const initialSources = [
    { id: '1', name: 'AUZEF', url: 'https://lolonolo.com/auzef/', active: true, lastScraped: '02.03.2026 14:30', questionsAdded: 1250, status: 'success' },
    { id: '2', name: 'Anadolu AÖF', url: 'https://lolonolo.com/anadolu-aof/', active: true, lastScraped: '01.03.2026 09:00', questionsAdded: 980, status: 'success' },
    { id: '3', name: 'Atatürk AÖF', url: 'https://lolonolo.com/ataturk-aof/', active: true, lastScraped: '28.02.2026 16:45', questionsAdded: 750, status: 'error' },
]

const initialLogs = [
    { id: '1', source: 'AUZEF', date: '02.03.2026 14:30', duration: '3dk 45sn', added: 45, status: 'success', error: null },
    { id: '2', source: 'Anadolu AÖF', date: '01.03.2026 09:00', duration: '2dk 12sn', added: 32, status: 'success', error: null },
    { id: '3', source: 'Atatürk AÖF', date: '28.02.2026 16:45', duration: '1dk 05sn', added: 0, status: 'error', error: 'Timeout: Sunucu 30 saniye içinde yanıt vermedi.' },
    { id: '4', source: 'AUZEF', date: '27.02.2026 10:00', duration: '4dk 20sn', added: 68, status: 'success', error: null },
    { id: '5', source: 'Anadolu AÖF', date: '26.02.2026 08:30', duration: '2dk 50sn', added: 41, status: 'success', error: null },
]

export default function Scraper() {
    const [sources, setSources] = useState(initialSources)
    const [logs] = useState(initialLogs)
    const [running, setRunning] = useState(null)
    const [progress, setProgress] = useState(0)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editSource, setEditSource] = useState(null)
    const [form, setForm] = useState({ name: '', url: '' })

    const runScraper = (id) => {
        setRunning(id)
        setProgress(0)
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) { clearInterval(interval); setRunning(null); return 100 }
                return prev + Math.random() * 15
            })
        }, 400)
    }

    const runAll = () => {
        setRunning('all')
        setProgress(0)
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) { clearInterval(interval); setRunning(null); return 100 }
                return prev + Math.random() * 8
            })
        }, 500)
    }

    const toggleSource = (id) => setSources(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s))

    const openEdit = (s) => { setEditSource(s); setForm({ name: s.name, url: s.url }); setShowAddModal(true) }
    const openAdd = () => { setEditSource(null); setForm({ name: '', url: '' }); setShowAddModal(true) }

    const saveSource = () => {
        if (!form.name || !form.url) return
        if (editSource) {
            setSources(prev => prev.map(s => s.id === editSource.id ? { ...s, ...form } : s))
        } else {
            setSources(prev => [...prev, { id: Date.now().toString(), ...form, active: true, lastScraped: '-', questionsAdded: 0, status: 'pending' }])
        }
        setShowAddModal(false)
    }

    const deleteSource = (id) => setSources(prev => prev.filter(s => s.id !== id))

    const exportLogs = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'scraper-logs.json'; a.click()
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-black">Veri Çekme (Scraper)</h1>
                <div className="flex gap-3">
                    <button onClick={openAdd} className="btn-ghost flex items-center gap-2"><Plus size={16} /> Kaynak Ekle</button>
                    <button onClick={runAll} disabled={running} className="btn-primary flex items-center gap-2 disabled:opacity-50"><Play size={16} /> Tümünü Çek</button>
                </div>
            </div>

            {/* Progress Bar */}
            {running && (
                <div className="glass-card p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-bold"><Loader size={16} className="animate-spin text-primary" /> Scraper çalışıyor{running !== 'all' ? `: ${sources.find(s => s.id === running)?.name}` : ': Tüm kaynaklar'}</div>
                        <span className="text-sm text-gray-400">{Math.min(100, Math.round(progress))}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                </div>
            )}

            {/* Sources */}
            <h2 className="text-lg font-bold mb-4">Kaynak Yönetimi</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {sources.map(src => (
                    <div key={src.id} className={`glass-card p-6 ${!src.active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold">{src.name}</h3>
                            <div className="flex items-center gap-1">
                                <button onClick={() => runScraper(src.id)} disabled={running} className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors text-gray-400 hover:text-primary disabled:opacity-30"><Play size={16} /></button>
                                <button onClick={() => openEdit(src)} className="p-1.5 hover:bg-yellow-400/20 rounded-lg transition-colors text-gray-400 hover:text-yellow-400"><Edit size={14} /></button>
                                <button onClick={() => deleteSource(src.id)} className="p-1.5 hover:bg-red-400/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 mb-3 break-all">{src.url}</div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Son: {src.lastScraped}</span>
                            <span className={`flex items-center gap-1 font-bold ${src.status === 'success' ? 'text-secondary' : src.status === 'error' ? 'text-danger' : 'text-gray-400'}`}>
                                {src.status === 'success' ? <CheckCircle size={12} /> : src.status === 'error' ? <AlertCircle size={12} /> : null}
                                {src.questionsAdded} soru
                            </span>
                        </div>
                        <button onClick={() => toggleSource(src.id)} className="mt-3 text-xs text-gray-400 hover:text-white transition-colors">{src.active ? 'Devre dışı bırak' : 'Aktifleştir'}</button>
                    </div>
                ))}
            </div>

            {/* Logs */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Scrape Logları</h2>
                <button onClick={exportLogs} className="btn-ghost flex items-center gap-2 text-sm"><Download size={14} /> JSON Export</button>
            </div>
            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                            <th className="p-4">Tarih</th><th className="p-4">Kaynak</th><th className="p-4">Süre</th><th className="p-4">Eklenen</th><th className="p-4">Durum</th><th className="p-4">Hata</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {logs.map(log => (
                            <tr key={log.id} className={`hover:bg-white/5 transition-colors ${log.status === 'error' ? 'bg-red-500/5' : ''}`}>
                                <td className="p-4 text-sm font-mono text-gray-400">{log.date}</td>
                                <td className="p-4 text-sm font-bold">{log.source}</td>
                                <td className="p-4 text-sm text-gray-300">{log.duration}</td>
                                <td className="p-4 text-sm font-bold text-secondary">{log.added}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${log.status === 'success' ? 'bg-secondary/20 text-secondary' : 'bg-red-500/20 text-red-400'}`}>
                                        {log.status === 'success' ? 'Başarılı' : 'Hata'}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-red-400">{log.error || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                    <div className="glass-card p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black">{editSource ? 'Kaynak Düzenle' : 'Yeni Kaynak Ekle'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-xs text-gray-400 font-bold mb-1 block">Kaynak Adı</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder="Örn: AUZEF" /></div>
                            <div><label className="text-xs text-gray-400 font-bold mb-1 block">URL</label>
                                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder="https://lolonolo.com/auzef/" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={saveSource} className="btn-primary flex-1">{editSource ? 'Güncelle' : 'Ekle'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
