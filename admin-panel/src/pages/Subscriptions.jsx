import React, { useState, useEffect } from 'react'
import { CreditCard, Edit, ToggleLeft, ToggleRight, Plus, X, DollarSign, Clock, Users, CheckCircle } from 'lucide-react'
import api from '../api'

export default function Subscriptions() {
    const [plans, setPlans] = useState([])
    const [subscriptions, setSubscriptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [editPlan, setEditPlan] = useState(null)
    const [planForm, setPlanForm] = useState({})

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [plansRes, subsRes] = await Promise.all([
                api.get('/plans'),
                api.get('/subscriptions')
            ])
            setPlans(plansRes.data || [])
            setSubscriptions(subsRes.data?.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function togglePlan(id) {
        const plan = plans.find(p => p.id === id)
        if (!plan) return
        try {
            await api.put(`/plans/${id}`, { is_active: !plan.is_active })
            loadData()
        } catch (err) { console.error(err) }
    }

    function openEditPlan(p) {
        setPlanForm({ ...p })
        setEditPlan(p.id ? 'edit' : 'add')
    }

    function openAddPlan() {
        setPlanForm({ name: '', monthly_price: '', daily_free_minutes: 10, is_active: true })
        setEditPlan('add')
    }

    async function savePlan() {
        try {
            if (editPlan === 'add') {
                await api.post('/plans', planForm)
            } else {
                await api.put(`/plans/${planForm.id}`, planForm)
            }
            setEditPlan(null)
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Hata')
        }
    }

    async function updateSubscription(id, updates) {
        try {
            await api.put(`/subscriptions/${id}`, updates)
            loadData()
        } catch (err) { console.error(err) }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold">Abonelik Yönetimi</h1>
                <p className="text-gray-400 mt-1">Plan yönetimi ve abonelik listesi</p>
            </div>

            {/* Plans */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Planlar</h2>
                <button onClick={openAddPlan} className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all">
                    <Plus size={16} /> Yeni Plan
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {plans.map(p => (
                    <div key={p.id} className={`bg-dark-2 rounded-2xl border p-6 ${p.is_active ? 'border-primary/30' : 'border-white/5 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-bold text-lg">{p.name}</span>
                            <button onClick={() => togglePlan(p.id)}>
                                {p.is_active ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-gray-500" />}
                            </button>
                        </div>
                        <div className="text-3xl font-bold text-primary mb-1">₺{parseFloat(p.monthly_price).toFixed(2)}</div>
                        <div className="text-sm text-gray-400 mb-4">/ ay</div>
                        <div className="text-sm text-gray-400 flex items-center gap-2 mb-4">
                            <Clock size={14} /> Günlük {p.daily_free_minutes} dk ücretsiz
                        </div>
                        <button onClick={() => openEditPlan(p)} className="w-full py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all text-sm">
                            <Edit size={14} className="inline mr-1" /> Düzenle
                        </button>
                    </div>
                ))}
                {plans.length === 0 && (
                    <div className="col-span-3 text-center py-8 text-gray-400">Henüz plan oluşturulmamış.</div>
                )}
            </div>

            {/* Subscription List */}
            <h2 className="text-lg font-bold mb-4">Abonelik Listesi</h2>
            <div className="bg-dark-2 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Kullanıcı</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Plan</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Durum</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Başlangıç</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Bitiş</th>
                            <th className="text-right text-xs font-bold text-gray-500 uppercase px-6 py-4">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.map(s => (
                            <tr key={s.id} className="border-b border-white/5 hover:bg-white/[.02]">
                                <td className="px-6 py-4">
                                    <div className="font-semibold">{s.first_name} {s.last_name}</div>
                                    <div className="text-sm text-gray-400">{s.email}</div>
                                </td>
                                <td className="px-6 py-4 text-sm">{s.plan}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                                            s.status === 'expired' ? 'bg-gray-500/20 text-gray-400' :
                                                'bg-red-500/20 text-red-400'
                                        }`}>{s.status === 'active' ? 'Aktif' : s.status === 'expired' ? 'Süresi Dolmuş' : 'İptal'}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">{s.start_date ? new Date(s.start_date).toLocaleDateString('tr-TR') : '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-400">{s.end_date ? new Date(s.end_date).toLocaleDateString('tr-TR') : '—'}</td>
                                <td className="px-6 py-4 text-right">
                                    {s.status === 'active' && (
                                        <button onClick={() => updateSubscription(s.id, { status: 'cancelled' })} className="text-xs text-red-400 hover:text-red-300 transition-all">
                                            İptal Et
                                        </button>
                                    )}
                                    {s.status !== 'active' && (
                                        <button onClick={() => updateSubscription(s.id, { status: 'active', end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })} className="text-xs text-emerald-400 hover:text-emerald-300 transition-all">
                                            Aktif Et
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {subscriptions.length === 0 && (
                            <tr><td colSpan="6" className="text-center py-12 text-gray-400">Henüz abonelik bulunmuyor.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Plan Modal */}
            {editPlan && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-dark-2 rounded-2xl border border-white/10 p-8 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">{editPlan === 'add' ? 'Yeni Plan' : 'Plan Düzenle'}</h2>
                            <button onClick={() => setEditPlan(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <input value={planForm.name || ''} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Plan Adı" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            <input value={planForm.monthly_price || ''} onChange={e => setPlanForm(f => ({ ...f, monthly_price: e.target.value }))} placeholder="Aylık Fiyat (₺)" type="number" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            <input value={planForm.daily_free_minutes || ''} onChange={e => setPlanForm(f => ({ ...f, daily_free_minutes: parseInt(e.target.value) || 0 }))} placeholder="Günlük Ücretsiz Dakika" type="number" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setEditPlan(null)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all">İptal</button>
                            <button onClick={savePlan} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold transition-all">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
