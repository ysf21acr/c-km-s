import React, { useState, useEffect } from 'react'
import { Save, Globe, Shield, ToggleLeft, ToggleRight, User, Image as ImageIcon, Link as LinkIcon, Upload } from 'lucide-react'
import api from '../api'

export default function Settings() {
    const [settings, setSettings] = useState({
        monthly_price: '49.99',
        trial_seconds: '600',
        site_name: 'Açık ve Uzaktan Akademi',
        maintenance_mode: 'false',
        registration_enabled: 'true',
        max_daily_questions: '100'
    })
    const [profile, setProfile] = useState({
        email: '',
        first_name: '',
        last_name: '',
        current_password: '',
        new_password: ''
    })
    const [branding, setBranding] = useState({
        site_logo_url: '',
        site_favicon_url: ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState('')

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        try {
            const [settingsRes, profileRes, brandingRes] = await Promise.all([
                api.get('/settings'),
                api.get('/profile'),
                api.get('/branding')
            ])
            setSettings(prev => ({ ...prev, ...settingsRes.data }))
            setProfile(prev => ({
                ...prev,
                email: profileRes.data?.email || '',
                first_name: profileRes.data?.first_name || '',
                last_name: profileRes.data?.last_name || '',
                current_password: '',
                new_password: ''
            }))
            setBranding(prev => ({ ...prev, ...brandingRes.data }))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveSettings() {
        setSaving(true)
        try {
            await api.put('/settings', settings)
            setSaved('Genel ayarlar kaydedildi.')
            setTimeout(() => setSaved(''), 3000)
        } catch (err) {
            alert(err.response?.data?.error || 'Ayarlar kaydedilemedi')
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveProfile() {
        setSaving(true)
        try {
            const payload = {
                email: profile.email,
                first_name: profile.first_name,
                last_name: profile.last_name
            }
            if (profile.new_password) {
                payload.current_password = profile.current_password
                payload.new_password = profile.new_password
            }
            const { data } = await api.put('/profile', payload)
            if (data?.user) {
                localStorage.setItem('admin_user', JSON.stringify(data.user))
            }
            setProfile(prev => ({ ...prev, current_password: '', new_password: '' }))
            setSaved('Admin profili güncellendi.')
            setTimeout(() => setSaved(''), 3000)
        } catch (err) {
            alert(err.response?.data?.error || 'Profil güncellenemedi')
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveBrandingLinks() {
        setSaving(true)
        try {
            await api.put('/branding', branding)
            await api.put('/settings', branding)
            setSaved('Logo ve ikon linkleri güncellendi.')
            setTimeout(() => setSaved(''), 3000)
        } catch (err) {
            alert(err.response?.data?.error || 'Marka ayarları kaydedilemedi')
        } finally {
            setSaving(false)
        }
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    async function uploadBrandFile(type, file) {
        if (!file) return
        setSaving(true)
        try {
            const fileData = await fileToDataUrl(file)
            const { data } = await api.post('/branding/upload', {
                type,
                file_name: file.name,
                file_data: fileData
            })
            const key = type === 'logo' ? 'site_logo_url' : 'site_favicon_url'
            const nextBranding = { ...branding, [key]: data.url || '' }
            setBranding(nextBranding)
            await api.put('/settings', nextBranding)
            setSaved(`${type === 'logo' ? 'Logo' : 'İkon'} yüklendi.`)
            setTimeout(() => setSaved(''), 3000)
        } catch (err) {
            alert(err.response?.data?.error || 'Dosya yüklenemedi')
        } finally {
            setSaving(false)
        }
    }

    function Toggle({ value, onChange }) {
        const isOn = value === 'true' || value === true
        return (
            <button onClick={() => onChange(String(!isOn))}>
                {isOn ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-gray-500" />}
            </button>
        )
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Ayarlar</h1>
                    <p className="text-gray-400 mt-1">Profil, güvenlik, site ayarları ve marka yönetimi</p>
                </div>
                <button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
                    <Save size={18} /> {saving ? 'Kaydediliyor...' : 'Genel Ayarları Kaydet'}
                </button>
            </div>
            {saved && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl mb-6 text-sm">✓ {saved}</div>}

            <div className="space-y-6">
                <div className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <User size={20} className="text-cyan-400" />
                        <h2 className="font-bold text-lg">Admin Profili ve Şifre</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={profile.first_name} onChange={e => setProfile(s => ({ ...s, first_name: e.target.value }))} placeholder="Ad" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        <input value={profile.last_name} onChange={e => setProfile(s => ({ ...s, last_name: e.target.value }))} placeholder="Soyad" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        <input value={profile.email} onChange={e => setProfile(s => ({ ...s, email: e.target.value }))} placeholder="E-posta" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none md:col-span-2" />
                        <input value={profile.current_password} onChange={e => setProfile(s => ({ ...s, current_password: e.target.value }))} placeholder="Mevcut Şifre (şifre değişimi için)" type="password" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        <input value={profile.new_password} onChange={e => setProfile(s => ({ ...s, new_password: e.target.value }))} placeholder="Yeni Şifre (opsiyonel)" type="password" className="bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                    </div>
                    <div className="mt-4">
                        <button onClick={handleSaveProfile} className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all">
                            Profili Güncelle
                        </button>
                    </div>
                </div>

                <div className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <ImageIcon size={20} className="text-amber-400" />
                        <h2 className="font-bold text-lg">Site Logo ve İkon</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Logo Linki</label>
                            <div className="flex gap-2">
                                <input value={branding.site_logo_url || ''} onChange={e => setBranding(s => ({ ...s, site_logo_url: e.target.value }))} placeholder="https://.../logo.png" className="flex-1 bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                                <button onClick={handleSaveBrandingLinks} className="px-3 rounded-xl border border-white/10 text-gray-300 hover:text-white"><LinkIcon size={16} /></button>
                            </div>
                            <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 cursor-pointer hover:border-primary/50">
                                <Upload size={16} />
                                <span className="text-sm">Dosya Yükle</span>
                                <input type="file" className="hidden" onChange={e => uploadBrandFile('logo', e.target.files?.[0])} />
                            </label>
                            {branding.site_logo_url && <img src={branding.site_logo_url} alt="logo" className="mt-3 h-14 object-contain rounded bg-dark p-2 border border-white/10" />}
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Favicon Linki</label>
                            <div className="flex gap-2">
                                <input value={branding.site_favicon_url || ''} onChange={e => setBranding(s => ({ ...s, site_favicon_url: e.target.value }))} placeholder="https://.../favicon.ico" className="flex-1 bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                                <button onClick={handleSaveBrandingLinks} className="px-3 rounded-xl border border-white/10 text-gray-300 hover:text-white"><LinkIcon size={16} /></button>
                            </div>
                            <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 cursor-pointer hover:border-primary/50">
                                <Upload size={16} />
                                <span className="text-sm">Dosya Yükle</span>
                                <input type="file" className="hidden" onChange={e => uploadBrandFile('favicon', e.target.files?.[0])} />
                            </label>
                            {branding.site_favicon_url && <img src={branding.site_favicon_url} alt="favicon" className="mt-3 h-10 w-10 object-contain rounded bg-dark p-2 border border-white/10" />}
                        </div>
                    </div>
                </div>

                <div className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Globe size={20} className="text-primary" />
                        <h2 className="font-bold text-lg">Genel Ayarlar</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Site Adı</label>
                            <input value={settings.site_name || ''} onChange={e => setSettings(s => ({ ...s, site_name: e.target.value }))} className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Aylık Abonelik Fiyatı (₺)</label>
                            <input value={settings.monthly_price || ''} onChange={e => setSettings(s => ({ ...s, monthly_price: e.target.value }))} type="number" step="0.01" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Günlük Ücretsiz Süre (saniye)</label>
                            <input value={settings.trial_seconds || ''} onChange={e => setSettings(s => ({ ...s, trial_seconds: e.target.value }))} type="number" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                            <p className="text-xs text-gray-500 mt-1">{Math.round((settings.trial_seconds || 0) / 60)} dakika</p>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-400 mb-2 block">Günlük Maks. Soru</label>
                            <input value={settings.max_daily_questions || ''} onChange={e => setSettings(s => ({ ...s, max_daily_questions: e.target.value }))} type="number" className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none" />
                        </div>
                    </div>
                </div>

                <div className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield size={20} className="text-amber-400" />
                        <h2 className="font-bold text-lg">Güvenlik ve Kontrol</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-dark rounded-xl border border-white/5">
                            <div>
                                <div className="font-semibold">Bakım Modu</div>
                                <div className="text-sm text-gray-400">Site geçici olarak kapatılır</div>
                            </div>
                            <Toggle value={settings.maintenance_mode} onChange={v => setSettings(s => ({ ...s, maintenance_mode: v }))} />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-dark rounded-xl border border-white/5">
                            <div>
                                <div className="font-semibold">Yeni Kayıt</div>
                                <div className="text-sm text-gray-400">Yeni kullanıcı kayıt olabilir</div>
                            </div>
                            <Toggle value={settings.registration_enabled} onChange={v => setSettings(s => ({ ...s, registration_enabled: v }))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
