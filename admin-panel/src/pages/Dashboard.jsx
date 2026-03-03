import React, { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Users, UserCheck, DollarSign, UserPlus, TrendingUp, BookOpen, MessageSquare, Activity } from 'lucide-react'

const COLORS = ['#4361ee', '#06d6a0', '#ef476f', '#f9a826', '#7b2fbe', '#00b4d8']

const StatCard = ({ title, value, icon: Icon, colorClass, change }) => (
    <div className="glass-card p-6 flex items-start justify-between group hover:scale-[1.02] transition-transform cursor-default">
        <div>
            <div className="text-gray-400 text-sm font-semibold mb-2">{title}</div>
            <div className="text-3xl font-black tracking-tight">{value}</div>
            {change && <div className={`text-xs mt-1 font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>{change > 0 ? '↑' : '↓'} %{Math.abs(change)} bu ay</div>}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass}`}>
            <Icon size={24} />
        </div>
    </div>
)

export default function Dashboard() {
    const [metrics, setMetrics] = useState({ totalUsers: 0, activePremium: 0, monthlyRevenue: 0, todayRegistrations: 0 })
    const [loading, setLoading] = useState(true)

    const revenueTrend = [
        { name: 'Oca', income: 12000 }, { name: 'Şub', income: 18500 }, { name: 'Mar', income: 22000 },
        { name: 'Nis', income: 28000 }, { name: 'May', income: 32000 }, { name: 'Haz', income: 38000 },
        { name: 'Tem', income: 35000 }, { name: 'Ağu', income: 41000 }, { name: 'Eyl', income: 45000 },
        { name: 'Eki', income: 48000 }, { name: 'Kas', income: 52000 }, { name: 'Ara', income: 58000 },
    ]

    const userGrowth = [
        { name: 'Oca', users: 120 }, { name: 'Şub', users: 280 }, { name: 'Mar', users: 450 },
        { name: 'Nis', users: 620 }, { name: 'May', users: 890 }, { name: 'Haz', users: 1100 },
        { name: 'Tem', users: 1350 }, { name: 'Ağu', users: 1600 }, { name: 'Eyl', users: 2100 },
        { name: 'Eki', users: 2600 }, { name: 'Kas', users: 3050 }, { name: 'Ara', users: 3421 },
    ]

    const topCourses = [
        { name: 'Anatomi', solved: 4520 }, { name: 'Fizyoloji', solved: 3800 }, { name: 'Biyokimya', solved: 3200 },
        { name: 'Farmakoloji', solved: 2900 }, { name: 'Histoloji', solved: 2400 },
    ]

    const planDist = [
        { name: 'Premium', value: 840 }, { name: 'Ücretsiz', value: 2581 },
    ]

    const recentUsers = [
        { name: 'Alperen G.', email: 'alperen@mail.com', plan: 'Premium', date: '2 dk önce' },
        { name: 'Ayşe Y.', email: 'ayse@mail.com', plan: 'Free', date: '15 dk önce' },
        { name: 'Mehmet K.', email: 'mehmet@mail.com', plan: 'Premium', date: '1 saat önce' },
        { name: 'Zeynep Ç.', email: 'zeynep@mail.com', plan: 'Free', date: '2 saat önce' },
        { name: 'Kaan D.', email: 'kaan@mail.com', plan: 'Premium', date: '3 saat önce' },
    ]

    const recentMessages = [
        { name: 'Fatma Ö.', subject: 'Ödeme sorunu yaşıyorum', status: 'unread', time: '5 dk önce' },
        { name: 'Ali R.', subject: 'Soru hatası bildirmek istiyorum', status: 'read', time: '1 saat önce' },
        { name: 'Selin T.', subject: 'Premium aboneliğimi iptal edemiyorum', status: 'replied', time: '3 saat önce' },
    ]

    useEffect(() => {
        setLoading(true)
        // Simulate API call — replace with real fetch('/api/v1/admin/dashboard/metrics')
        setTimeout(() => {
            setMetrics({ totalUsers: 3421, activePremium: 840, monthlyRevenue: 58000, todayRegistrations: 42 })
            setLoading(false)
        }, 600)
    }, [])

    return (
        <div>
            <h1 className="text-2xl font-black mb-8">Dashboard Özeti</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Toplam Kullanıcı" value={loading ? '...' : metrics.totalUsers.toLocaleString()} icon={Users} colorClass="bg-primary/20 text-primary" change={12} />
                <StatCard title="Aktif Premium" value={loading ? '...' : metrics.activePremium.toLocaleString()} icon={UserCheck} colorClass="bg-secondary/20 text-secondary" change={8} />
                <StatCard title="Aylık Gelir" value={loading ? '...' : `₺${metrics.monthlyRevenue.toLocaleString()}`} icon={DollarSign} colorClass="bg-warning/20 text-warning" change={15} />
                <StatCard title="Bugün Kayıt" value={loading ? '...' : metrics.todayRegistrations} icon={UserPlus} colorClass="bg-purple-500/20 text-purple-400" change={-3} />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="glass-card p-6 lg:col-span-2">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-secondary" /> Aylık Gelir Trendi</h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3042" />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={v => `₺${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#1b263b', borderColor: '#2d3748', borderRadius: '12px', color: '#fff' }} formatter={v => [`₺${v.toLocaleString()}`, 'Gelir']} />
                                <Line type="monotone" dataKey="income" stroke="#06d6a0" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-6">Plan Dağılımı</h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={planDist} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1b263b', borderColor: '#2d3748', borderRadius: '12px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Activity size={20} className="text-primary" /> Kullanıcı Büyümesi</h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={userGrowth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3042" />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                                <YAxis stroke="#6b7280" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#1b263b', borderColor: '#2d3748', borderRadius: '12px', color: '#fff' }} />
                                <Line type="monotone" dataKey="users" stroke="#4361ee" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><BookOpen size={20} className="text-warning" /> En Çok Çözülen Dersler</h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topCourses} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3042" horizontal={false} />
                                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                                <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={12} width={90} />
                                <Tooltip contentStyle={{ backgroundColor: '#1b263b', borderColor: '#2d3748', borderRadius: '12px', color: '#fff' }} />
                                <Bar dataKey="solved" fill="#f9a826" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-4">Son Kayıtlar</h2>
                    <div className="space-y-3">
                        {recentUsers.map((u, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm">{u.name.charAt(0)}</div>
                                    <div>
                                        <div className="text-sm font-bold">{u.name}</div>
                                        <div className="text-xs text-gray-400">{u.email}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${u.plan === 'Premium' ? 'bg-secondary/20 text-secondary' : 'bg-white/10 text-gray-400'}`}>{u.plan}</span>
                                    <div className="text-xs text-gray-500 mt-1">{u.date}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><MessageSquare size={18} /> Son Mesajlar</h2>
                    <div className="space-y-3">
                        {recentMessages.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    {m.status === 'unread' && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                                    {m.status !== 'unread' && <div className="w-2 h-2 rounded-full bg-gray-600" />}
                                    <div>
                                        <div className="text-sm font-bold">{m.name}</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{m.subject}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${m.status === 'unread' ? 'bg-primary/20 text-primary' : m.status === 'replied' ? 'bg-secondary/20 text-secondary' : 'bg-white/10 text-gray-400'}`}>
                                        {m.status === 'unread' ? 'Yeni' : m.status === 'replied' ? 'Yanıtlandı' : 'Okundu'}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">{m.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
