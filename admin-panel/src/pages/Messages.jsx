import React, { useState, useEffect } from 'react'
import { Mail, Reply, Trash2, CheckCheck, X, Send, MailOpen, Eye } from 'lucide-react'
import api from '../api'

export default function Messages() {
    const [messages, setMessages] = useState([])
    const [selected, setSelected] = useState(null)
    const [replyText, setReplyText] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadMessages() }, [])

    async function loadMessages() {
        setLoading(true)
        try {
            const { data } = await api.get('/messages')
            setMessages(data.messages || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function openMessage(m) {
        setSelected(m)
        setReplyText(m.admin_reply || '')
        if (m.status === 'unread') {
            try {
                await api.put(`/messages/${m.id}/status`, { status: 'read' })
                setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, status: 'read' } : msg))
            } catch (err) { console.error(err) }
        }
    }

    async function sendReply() {
        if (!replyText.trim() || !selected) return
        try {
            await api.put(`/messages/${selected.id}/reply`, { reply: replyText })
            setMessages(prev => prev.map(msg => msg.id === selected.id ? { ...msg, status: 'replied', admin_reply: replyText } : msg))
            setSelected(prev => ({ ...prev, status: 'replied', admin_reply: replyText }))
        } catch (err) {
            alert(err.response?.data?.error || 'Hata')
        }
    }

    async function deleteMessage(id) {
        if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return
        try {
            await api.delete(`/messages/${id}`)
            setMessages(prev => prev.filter(m => m.id !== id))
            if (selected?.id === id) setSelected(null)
        } catch (err) { console.error(err) }
    }

    async function markAllRead() {
        const unread = messages.filter(m => m.status === 'unread')
        for (const m of unread) {
            try { await api.put(`/messages/${m.id}/status`, { status: 'read' }) } catch { }
        }
        loadMessages()
    }

    const statusBadge = (status) => {
        const styles = {
            unread: 'bg-primary/20 text-primary',
            read: 'bg-gray-500/20 text-gray-400',
            replied: 'bg-emerald-500/20 text-emerald-400'
        }
        const labels = { unread: 'Okunmadı', read: 'Okundu', replied: 'Yanıtlandı' }
        return <span className={`text-xs font-bold px-3 py-1 rounded-full ${styles[status] || styles.read}`}>{labels[status] || status}</span>
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">İletişim Formları</h1>
                    <p className="text-gray-400 mt-1">{messages.length} mesaj</p>
                </div>
                <button onClick={markAllRead} className="flex items-center gap-2 text-gray-400 hover:text-white transition-all text-sm">
                    <CheckCheck size={16} /> Tümünü Okundu İşaretle
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Message List */}
                <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                    {messages.map(m => (
                        <div key={m.id} onClick={() => openMessage(m)}
                            className={`bg-dark-2 rounded-xl border p-4 cursor-pointer transition-all ${selected?.id === m.id ? 'border-primary' : 'border-white/5 hover:border-white/10'} ${m.status === 'unread' ? 'border-l-4 border-l-primary' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm truncate">{m.sender_name}</span>
                                {statusBadge(m.status)}
                            </div>
                            <div className="text-sm text-gray-400 truncate">{m.subject || 'Konu yok'}</div>
                            <div className="text-xs text-gray-500 mt-2">{new Date(m.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    ))}
                    {messages.length === 0 && (
                        <div className="text-center py-12 text-gray-400">Henüz mesaj yok.</div>
                    )}
                </div>

                {/* Message Detail */}
                <div className="lg:col-span-2">
                    {selected ? (
                        <div className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">{selected.subject || 'Konu yok'}</h3>
                                    <div className="text-sm text-gray-400 mt-1">
                                        {selected.sender_name} — <span className="text-gray-500">{selected.sender_email}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{new Date(selected.created_at).toLocaleString('tr-TR')}</div>
                                </div>
                                <button onClick={() => deleteMessage(selected.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all">
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="bg-dark rounded-xl p-4 border border-white/5 mb-6 whitespace-pre-wrap text-gray-300 leading-relaxed">
                                {selected.message}
                            </div>

                            {selected.admin_reply && (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                                    <div className="text-xs font-bold text-primary mb-2">Admin Yanıtı:</div>
                                    <div className="text-gray-300 whitespace-pre-wrap">{selected.admin_reply}</div>
                                </div>
                            )}

                            {/* Reply */}
                            <div>
                                <label className="text-sm font-bold text-gray-400 mb-2 block">Yanıt Yaz</label>
                                <textarea
                                    value={replyText} onChange={e => setReplyText(e.target.value)}
                                    placeholder="Yanıtınızı yazın..."
                                    rows={4}
                                    className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none resize-none"
                                />
                                <div className="flex justify-end mt-3">
                                    <button onClick={sendReply} disabled={!replyText.trim()} className="flex items-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
                                        <Send size={16} /> Yanıtla
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-dark-2 rounded-2xl border border-white/5 p-12 text-center">
                            <Mail size={48} className="text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">Bir mesaj seçin</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
