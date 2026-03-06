import React, { useEffect, useState } from 'react'
import { Users, UserCheck, DollarSign, UserPlus, MessageSquare, FileText, HelpCircle } from 'lucide-react'
import api from '../api'

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-dark-2 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all">
        <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                <Icon size={22} />
            </div>
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
    </div>
)

export default function Dashboard() {
    const [metrics, setMetrics] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadMetrics()
    }, [])

    async function loadMetrics() {
        try {
            const { data } = await api.get('/dashboard/metrics')
            setMetrics(data)
        } catch (err) {
            console.error('Metrics load error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const m = metrics || {}

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-gray-400 mt-1">Platform genel durumu</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Toplam Kullanıcı" value={m.totalUsers ?? 0} icon={Users} colorClass="bg-primary/20 text-primary" />
                <StatCard title="Aktif Premium" value={m.activePremium ?? 0} icon={UserCheck} colorClass="bg-emerald-500/20 text-emerald-400" />
                <StatCard title="Bugün Kayıt" value={m.todayRegistrations ?? 0} icon={UserPlus} colorClass="bg-amber-500/20 text-amber-400" />
                <StatCard title="Aylık Gelir" value={`₺${(m.monthlyRevenue ?? 0).toLocaleString('tr-TR')}`} icon={DollarSign} colorClass="bg-rose-500/20 text-rose-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <StatCard title="Toplam Soru" value={m.totalQuestions ?? 0} icon={HelpCircle} colorClass="bg-violet-500/20 text-violet-400" />
                <StatCard title="Toplam Sınav" value={m.totalExams ?? 0} icon={FileText} colorClass="bg-cyan-500/20 text-cyan-400" />
                <StatCard title="Okunmamış Mesaj" value={m.unreadMessages ?? 0} icon={MessageSquare} colorClass="bg-orange-500/20 text-orange-400" />
            </div>
        </div>
    )
}
