import React, { useState } from 'react'
import { CreditCard, Edit, ToggleLeft, ToggleRight, Plus, X, DollarSign, Clock, Users, CheckCircle } from 'lucide-react'

const initialPlans = [
    { id: '1', name: 'Ücretsiz', price: 0, dailyMinutes: 10, features: ['Günlük 10 dk erişim', 'Temel istatistikler'], active: true },
    { id: '2', name: 'Premium Aylık', price: 49.90, dailyMinutes: 0, features: ['Sınırsız erişim', 'Tüm istatistikler', 'Reklamsız', 'Öncelikli destek'], active: true },
    { id: '3', name: 'Premium Yıllık', price: 399.90, dailyMinutes: 0, features: ['Sınırsız erişim', 'Tüm istatistikler', 'Reklamsız', 'Öncelikli destek', '%33 indirim'], active: true },
]

const initialSubs = [
    { id: '1', user: 'Alperen Güneş', email: 'alperen@mail.com', plan: 'Premium Aylık', status: 'active', start: '01.02.2026', end: '01.03.2026', amount: '₺49.90' },
    { id: '2', user: 'Murat Kaya', email: 'murat@mail.com', plan: 'Premium Yıllık', status: 'active', start: '15.01.2026', end: '15.01.2027', amount: '₺399.90' },
    { id: '3', user: 'Kaan Demir', email: 'kaan@mail.com', plan: 'Premium Aylık', status: 'expired', start: '01.01.2026', end: '01.02.2026', amount: '₺49.90' },
    { id: '4', user: 'Fatma Özdemir', email: 'fatma@mail.com', plan: 'Premium Aylık', status: 'cancelled', start: '10.12.2025', end: '10.01.2026', amount: '₺49.90' },
]

export default function Subscriptions() {
    const [plans, setPlans] = useState(initialPlans)
    const [subs, setSubs] = useState(initialSubs)
    const [filter, setFilter] = useState('all')
    const [editPlan, setEditPlan] = useState(null)
    const [planForm, setPlanForm] = useState({ name: '', price: '', dailyMinutes: '', features: '' })

    const filteredSubs = subs.filter(s => filter === 'all' || s.status === filter)
    const totalRevenue = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + parseFloat(s.amount.replace('₺', '').replace(',', '.')), 0)

    const togglePlan = (id) => setPlans(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))

    const openEditPlan = (p) => {
        setEditPlan(p)
        setPlanForm({ name: p.name, price: p.price.toString(), dailyMinutes: p.dailyMinutes.toString(), features: p.features.join('\n') })
    }

    const savePlan = () => {
        if (!planForm.name) return
        setPlans(prev => prev.map(p => p.id === editPlan.id ? { ...p, name: planForm.name, price: parseFloat(planForm.price), dailyMinutes: parseInt(planForm.dailyMinutes) || 0, features: planForm.features.split('\n').filter(Boolean) } : p))
        setEditPlan(null)
    }

    return (
        <div>
            <h1 className="text-2xl font-black mb-8">Abonelik Yönetimi</h1>

            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center"><DollarSign className="text-secondary" size={24} /></div>
                    <div><div className="text-gray-400 text-sm">Aktif Abonelik Geliri</div><div className="text-2xl font-black">₺{totalRevenue.toFixed(2)}</div></div>
                </div>
                <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center"><Users className="text-primary" size={24} /></div>
                    <div><div className="text-gray-400 text-sm">Aktif Abonelikler</div><div className="text-2xl font-black">{subs.filter(s => s.status === 'active').length}</div></div>
                </div>
                <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-warning/20 flex items-center justify-center"><Clock className="text-warning" size={24} /></div>
                    <div><div className="text-gray-400 text-sm">Planlar</div><div className="text-2xl font-black">{plans.filter(p => p.active).length} Aktif</div></div>
                </div>
            </div>

            {/* Plans */}
            <h2 className="text-lg font-bold mb-4">Plan Yönetimi</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {plans.map(plan => (
                    <div key={plan.id} className={`glass-card p-6 transition-opacity ${!plan.active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">{plan.name}</h3>
                            <button onClick={() => togglePlan(plan.id)} className="text-gray-400 hover:text-white transition-colors">
                                {plan.active ? <ToggleRight size={28} className="text-secondary" /> : <ToggleLeft size={28} />}
                            </button>
                        </div>
                        <div className="text-3xl font-black mb-4">₺{plan.price}<span className="text-sm text-gray-400 font-normal">/ay</span></div>
                        {plan.dailyMinutes > 0 && <div className="text-xs text-warning mb-3">Günlük {plan.dailyMinutes} dk limit</div>}
                        <ul className="space-y-2 mb-4">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-300"><CheckCircle size={14} className="text-secondary" /> {f}</li>
                            ))}
                        </ul>
                        <button onClick={() => openEditPlan(plan)} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"><Edit size={14} /> Düzenle</button>
                    </div>
                ))}
            </div>

            {/* Subscriptions List */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Abonelik Listesi</h2>
                <div className="flex gap-2">
                    {[['all', 'Tümü'], ['active', 'Aktif'], ['expired', 'Süresi Dolmuş'], ['cancelled', 'İptal']].map(([v, l]) => (
                        <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === v ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{l}</button>
                    ))}
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                            <th className="p-4">Kullanıcı</th><th className="p-4">Plan</th><th className="p-4">Durum</th><th className="p-4">Başlangıç</th><th className="p-4">Bitiş</th><th className="p-4">Ödeme</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredSubs.map(s => (
                            <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4"><div className="font-bold text-sm">{s.user}</div><div className="text-xs text-gray-400">{s.email}</div></td>
                                <td className="p-4 text-sm">{s.plan}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${s.status === 'active' ? 'bg-secondary/20 text-secondary' : s.status === 'expired' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {s.status === 'active' ? 'Aktif' : s.status === 'expired' ? 'Süresi Dolmuş' : 'İptal'}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-gray-400 font-mono">{s.start}</td>
                                <td className="p-4 text-sm text-gray-400 font-mono">{s.end}</td>
                                <td className="p-4 text-sm font-bold">{s.amount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Plan Modal */}
            {editPlan && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditPlan(null)}>
                    <div className="glass-card p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black">Plan Düzenle</h2>
                            <button onClick={() => setEditPlan(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-xs text-gray-400 font-bold mb-1 block">Plan Adı</label>
                                <input value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs text-gray-400 font-bold mb-1 block">Aylık Fiyat (₺)</label>
                                    <input type="number" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                                <div><label className="text-xs text-gray-400 font-bold mb-1 block">Günlük Dk Limit</label>
                                    <input type="number" value={planForm.dailyMinutes} onChange={e => setPlanForm({ ...planForm, dailyMinutes: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                            </div>
                            <div><label className="text-xs text-gray-400 font-bold mb-1 block">Özellikler (her satıra bir tane)</label>
                                <textarea value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })} rows={4} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditPlan(null)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={savePlan} className="btn-primary flex-1">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
