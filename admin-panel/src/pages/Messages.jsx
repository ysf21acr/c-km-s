import React, { useState } from 'react'
import { Mail, Eye, Reply, Trash2, CheckCheck, X, Send, MailOpen } from 'lucide-react'

const initialMessages = [
    { id: '1', name: 'Fatma Özdemir', email: 'fatma@mail.com', subject: 'Ödeme sorunu yaşıyorum', message: 'Merhaba, premium abonelik almak istiyorum fakat ödeme sayfası açılmıyor. Yardımcı olabilir misiniz?', status: 'unread', reply: '', date: '02.03.2026 16:30' },
    { id: '2', name: 'Ali Rıza Kılıç', email: 'ali@mail.com', subject: 'Soru hatası bildirmek istiyorum', message: 'Anatomi dersi 2023-2024 Güz Vize sınavında 15. sorunun cevabı yanlış görünüyor. B seçeneği doğru olmalı ama A işaretlenmiş.', status: 'read', reply: '', date: '02.03.2026 12:15' },
    { id: '3', name: 'Selin Toprak', email: 'selin@mail.com', subject: 'Premium aboneliğimi iptal edemiyorum', message: 'Abonelik ayarlarında iptal butonu çalışmıyor. Acil yardım lazım.', status: 'replied', reply: 'Merhaba Selin, sorununuzu çözdük. Aboneliğiniz başarıyla iptal edilmiştir.', date: '01.03.2026 09:00' },
    { id: '4', name: 'Mehmet Yıldırım', email: 'mehmet@mail.com', subject: 'Yeni ders talebi', message: 'Merhaba, Biyokimya dersini de ekleyebilir misiniz? Sınavlarıma çok yardımcı olacaktır.', status: 'unread', reply: '', date: '28.02.2026 14:20' },
    { id: '5', name: 'Deniz Acar', email: 'deniz@mail.com', subject: 'Teşekkür', message: 'Platform harika! Sınavlarımda çok başarılı oldum. Teşekkürler!', status: 'read', reply: '', date: '27.02.2026 10:00' },
]

export default function Messages() {
    const [messages, setMessages] = useState(initialMessages)
    const [selected, setSelected] = useState(null)
    const [replyText, setReplyText] = useState('')
    const [filter, setFilter] = useState('all')
    const [showConfirm, setShowConfirm] = useState(null)

    const filtered = messages.filter(m => filter === 'all' || m.status === filter)
    const unreadCount = messages.filter(m => m.status === 'unread').length

    const openMessage = (m) => {
        setSelected(m)
        setReplyText(m.reply || '')
        if (m.status === 'unread') {
            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, status: 'read' } : msg))
        }
    }

    const sendReply = () => {
        if (!replyText.trim()) return
        setMessages(prev => prev.map(m => m.id === selected.id ? { ...m, status: 'replied', reply: replyText } : m))
        setSelected({ ...selected, status: 'replied', reply: replyText })
    }

    const deleteMessage = (id) => { setMessages(prev => prev.filter(m => m.id !== id)); setShowConfirm(null); if (selected?.id === id) setSelected(null) }

    const markAllRead = () => setMessages(prev => prev.map(m => ({ ...m, status: m.status === 'unread' ? 'read' : m.status })))

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black">İletişim Formları</h1>
                    {unreadCount > 0 && <p className="text-sm text-primary mt-1">{unreadCount} okunmamış mesaj</p>}
                </div>
                <button onClick={markAllRead} className="btn-ghost flex items-center gap-2 text-sm"><CheckCheck size={16} /> Tümünü Okundu İşaretle</button>
            </div>

            <div className="flex gap-2 mb-6">
                {[['all', 'Tümü'], ['unread', 'Okunmadı'], ['read', 'Okundu'], ['replied', 'Yanıtlandı']].map(([v, l]) => (
                    <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === v ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{l}</button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Message List */}
                <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                    {filtered.map(m => (
                        <div key={m.id} onClick={() => openMessage(m)} className={`glass-card p-4 cursor-pointer hover:bg-white/10 transition-colors ${selected?.id === m.id ? 'border-primary border' : ''} ${m.status === 'unread' ? 'border-l-4 border-l-primary' : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm">{m.name}</span>
                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${m.status === 'unread' ? 'bg-primary/20 text-primary' : m.status === 'replied' ? 'bg-secondary/20 text-secondary' : 'bg-white/10 text-gray-400'}`}>
                                    {m.status === 'unread' ? 'Yeni' : m.status === 'replied' ? 'Yanıtlandı' : 'Okundu'}
                                </span>
                            </div>
                            <div className="text-sm text-gray-300 truncate">{m.subject}</div>
                            <div className="text-xs text-gray-500 mt-1">{m.date}</div>
                        </div>
                    ))}
                </div>

                {/* Message Detail */}
                <div className="lg:col-span-2">
                    {selected ? (
                        <div className="glass-card p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold">{selected.subject}</h2>
                                    <div className="text-sm text-gray-400 mt-1">{selected.name} • {selected.email}</div>
                                    <div className="text-xs text-gray-500">{selected.date}</div>
                                </div>
                                <button onClick={() => setShowConfirm(selected)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 size={18} /></button>
                            </div>

                            <div className="bg-white/5 rounded-xl p-5 mb-6">
                                <p className="text-sm leading-relaxed text-gray-200">{selected.message}</p>
                            </div>

                            {selected.reply && (
                                <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-5 mb-6">
                                    <div className="flex items-center gap-2 text-secondary text-xs font-bold mb-2"><Reply size={14} /> Admin Yanıtı</div>
                                    <p className="text-sm text-gray-200">{selected.reply}</p>
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-2 block">{selected.status === 'replied' ? 'Yanıtı Güncelle' : 'Yanıt Yaz'}</label>
                                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none mb-3" placeholder="Yanıtınızı yazın..." />
                                <button onClick={sendReply} className="btn-primary flex items-center gap-2"><Send size={16} /> Yanıt Gönder</button>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-12 text-center">
                            <MailOpen size={48} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-400">Bir mesaj seçin</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirm */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-8 w-full max-w-sm text-center">
                        <Trash2 size={40} className="text-danger mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">Mesajı Sil</h3>
                        <p className="text-gray-400 text-sm mb-6">Bu mesajı silmek istediğinize emin misiniz?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(null)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={() => deleteMessage(showConfirm.id)} className="bg-danger text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-600 transition-all flex-1">Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
