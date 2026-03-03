import React, { useState } from 'react'
import { Save, Globe, Mail, Bell, Shield, Upload, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Settings() {
    const [activeTab, setActiveTab] = useState('general')
    const [saved, setSaved] = useState(false)

    const [general, setGeneral] = useState({ siteName: 'MedDoc Akademi', metaTitle: 'MedDoc - Online Sınav Hazırlık Platformu', metaDesc: 'Üniversite sınavlarına en etkili şekilde hazırlanın. Binlerce soru ve detaylı istatistiklerle başarıya ulaşın.', maintenance: false })
    const [email, setEmail] = useState({ smtpHost: 'smtp.gmail.com', smtpPort: '587', smtpUser: '', smtpPass: '', templates: { register: true, passwordReset: true, subscription: true } })
    const [notif, setNotif] = useState({ adminEmail: 'admin@meddoc.com', newRegistration: true, payment: true, scrapeError: true })

    const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

    const tabs = [
        { id: 'general', label: 'Genel', icon: Globe },
        { id: 'email', label: 'E-posta', icon: Mail },
        { id: 'notifications', label: 'Bildirimler', icon: Bell },
    ]

    const Toggle = ({ value, onChange }) => (
        <button onClick={() => onChange(!value)} className="text-gray-400 hover:text-white transition-colors">
            {value ? <ToggleRight size={28} className="text-secondary" /> : <ToggleLeft size={28} />}
        </button>
    )

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-black">Ayarlar</h1>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                    <Save size={16} /> {saved ? '✓ Kaydedildi!' : 'Değişiklikleri Kaydet'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === t.id ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="glass-card p-6 space-y-6">
                    <div>
                        <label className="text-xs text-gray-400 font-bold mb-1 block">Site Adı</label>
                        <input value={general.siteName} onChange={e => setGeneral({ ...general, siteName: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 font-bold mb-1 block">Logo</label>
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                                <Upload size={32} className="mx-auto text-gray-500 mb-2" />
                                <p className="text-xs text-gray-400">PNG, SVG veya JPG yükleyin</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold mb-1 block">Favicon</label>
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                                <Upload size={32} className="mx-auto text-gray-500 mb-2" />
                                <p className="text-xs text-gray-400">32x32 ICO veya PNG</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Shield size={16} className="text-primary" /> SEO Ayarları</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">Meta Title</label>
                                <input value={general.metaTitle} onChange={e => setGeneral({ ...general, metaTitle: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">Meta Description</label>
                                <textarea value={general.metaDesc} onChange={e => setGeneral({ ...general, metaDesc: e.target.value })} rows={3} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold">Bakım Modu</h3>
                                <p className="text-xs text-gray-400 mt-1">Aktifleştirildiğinde kullanıcılar siteye erişemez</p>
                            </div>
                            <Toggle value={general.maintenance} onChange={v => setGeneral({ ...general, maintenance: v })} />
                        </div>
                    </div>
                </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
                <div className="glass-card p-6 space-y-6">
                    <h3 className="font-bold">SMTP Ayarları</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs text-gray-400 font-bold mb-1 block">SMTP Host</label>
                            <input value={email.smtpHost} onChange={e => setEmail({ ...email, smtpHost: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                        <div><label className="text-xs text-gray-400 font-bold mb-1 block">SMTP Port</label>
                            <input value={email.smtpPort} onChange={e => setEmail({ ...email, smtpPort: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                        <div><label className="text-xs text-gray-400 font-bold mb-1 block">Kullanıcı Adı</label>
                            <input value={email.smtpUser} onChange={e => setEmail({ ...email, smtpUser: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                        <div><label className="text-xs text-gray-400 font-bold mb-1 block">Şifre</label>
                            <input type="password" value={email.smtpPass} onChange={e => setEmail({ ...email, smtpPass: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" /></div>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                        <h3 className="font-bold mb-4">E-posta Şablonları</h3>
                        <div className="space-y-3">
                            {[['register', 'Kayıt Onay E-postası'], ['passwordReset', 'Şifre Sıfırlama E-postası'], ['subscription', 'Abonelik Onay E-postası']].map(([k, l]) => (
                                <div key={k} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                    <span className="text-sm font-semibold">{l}</span>
                                    <Toggle value={email.templates[k]} onChange={v => setEmail({ ...email, templates: { ...email.templates, [k]: v } })} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="glass-card p-6 space-y-6">
                    <div>
                        <label className="text-xs text-gray-400 font-bold mb-1 block">Admin Bildirim E-postası</label>
                        <input value={notif.adminEmail} onChange={e => setNotif({ ...notif, adminEmail: e.target.value })} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                    </div>

                    <div className="border-t border-white/10 pt-6">
                        <h3 className="font-bold mb-4">Bildirim Tercihleri</h3>
                        <div className="space-y-3">
                            {[['newRegistration', 'Yeni Kullanıcı Kaydı', 'Yeni bir kullanıcı kayıt olduğunda e-posta gönder'],
                            ['payment', 'Ödeme Bildirimi', 'Yeni bir ödeme yapıldığında bildirim gönder'],
                            ['scrapeError', 'Scraper Hata Bildirimi', 'Veri çekme işleminde hata oluştuğunda bildirim gönder']].map(([k, label, desc]) => (
                                <div key={k} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                                    <div>
                                        <div className="text-sm font-bold">{label}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                                    </div>
                                    <Toggle value={notif[k]} onChange={v => setNotif({ ...notif, [k]: v })} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
