import React, { useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, AlertCircle, CheckCircle, Loader, Download, Square, Trash2 } from 'lucide-react'
import api from '../api'

const UNIVERSITIES = [
    { key: 'AUZEF', name: 'Istanbul Universitesi AUZEF' },
    { key: 'ANADOLU_AOF', name: 'Anadolu Universitesi AOF' },
    { key: 'ATATURK_AOF', name: 'Ataturk Universitesi AOF' },
]

const STATUS_META = {
    running: { label: 'Calisiyor', tone: 'text-sky-300' },
    success: { label: 'Tamamlandi', tone: 'text-emerald-400' },
    error: { label: 'Hata', tone: 'text-red-400' },
    failed: { label: 'Hata', tone: 'text-red-400' },
}

const STAGE_LABELS = {
    starting: 'Baslatiliyor',
    start: 'Baslatiliyor',
    running: 'Calisiyor',
    departments_discovered: 'Bolumler bulundu',
    courses_discovered: 'Dersler bulundu',
    course_processed: 'Ders islendi',
    course_error: 'Ders hatasi',
    department_completed: 'Bolum tamamlandi',
    completed: 'Bitti',
    stopping: 'Durduruluyor',
    stopped: 'Durduruldu',
    orphaned: 'Yarida kaldi',
    error: 'Hata',
}

function uniName(key) {
    const found = UNIVERSITIES.find((u) => u.key === key)
    return found ? found.name : (key || 'ALL')
}

function formatDuration(seconds) {
    const value = Number(seconds || 0)
    if (!value) return '-'
    if (value < 60) return `${value}s`
    const minutes = Math.floor(value / 60)
    const remain = value % 60
    return `${minutes}m ${remain}s`
}

function formatCount(done, total) {
    const safeDone = Number(done || 0)
    const safeTotal = Number(total || 0)
    if (!safeTotal) return `${safeDone}`
    return `${safeDone}/${safeTotal}`
}

function statusIcon(status) {
    if (status === 'success') return <CheckCircle size={16} className="text-emerald-400" />
    if (status === 'error' || status === 'failed') return <AlertCircle size={16} className="text-red-400" />
    if (status === 'running') return <Loader size={16} className="text-sky-300 animate-spin" />
    return <AlertCircle size={16} className="text-gray-400" />
}

function stageText(log) {
    const label = STAGE_LABELS[log.stage] || log.stage || '-'
    if (log.status === 'running' && log.current_course) return `${label}: ${log.current_course}`
    if (log.status === 'running' && log.current_department) return `${label}: ${log.current_department}`
    if (log.last_completed_course) return `${label}: ${log.last_completed_course}`
    return label
}

function progressText(log) {
    return `%${Number(log.overall_progress_pct || 0)} (${formatCount(log.departments_done, log.departments_total)} bolum, ${formatCount(log.courses_done, log.courses_total)} ders)`
}

function questionText(log) {
    const found = Number(log.questions_found || 0)
    const saved = Number(log.questions_saved || log.questions_added || 0)
    const last = Number(log.last_course_questions || 0)
    if (!found && !saved && !last) return `${Number(log.questions_added || 0)}`
    return `${found} bulundu / ${saved} kaydedildi / son ders ${last}`
}

export default function Scraper() {
    const [logs, setLogs] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [busyKeys, setBusyKeys] = useState([])

    useEffect(() => {
        loadData(true)
    }, [])

    const runningKeys = useMemo(() => {
        const fromLogs = (logs || [])
            .filter((log) => log.status === 'running' && log.active)
            .map((log) => String(log.university_key || 'ALL').toUpperCase())
        return Array.from(new Set([...busyKeys, ...fromLogs]))
    }, [busyKeys, logs])

    useEffect(() => {
        if (runningKeys.length === 0) return undefined
        const timer = setInterval(() => loadData(false), 4000)
        return () => clearInterval(timer)
    }, [runningKeys])

    async function loadData(showLoader = false) {
        if (showLoader) setLoading(true)
        try {
            const [logsRes, statsRes] = await Promise.all([
                api.get('/scraper/logs'),
                api.get('/data/stats'),
            ])
            setLogs(logsRes.data || [])
            setStats(statsRes.data || null)
        } catch (err) {
            console.error(err)
        } finally {
            if (showLoader) setLoading(false)
        }
    }

    function markBusy(key) {
        const normalized = String(key || 'ALL').toUpperCase()
        setBusyKeys((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    }

    function clearBusy(key) {
        const normalized = String(key || 'ALL').toUpperCase()
        setBusyKeys((prev) => prev.filter((item) => item !== normalized))
    }

    function isRunning(key) {
        return runningKeys.includes(String(key || 'ALL').toUpperCase())
    }

    async function waitForCompletion(logId, universityKey) {
        const startedAt = Date.now()
        const timeoutMs = 20 * 60 * 1000

        return new Promise((resolve, reject) => {
            const timer = setInterval(async () => {
                try {
                    const [logsRes, statsRes] = await Promise.all([
                        api.get('/scraper/logs'),
                        api.get('/data/stats'),
                    ])
                    const freshLogs = logsRes.data || []
                    setLogs(freshLogs)
                    setStats(statsRes.data || null)

                    const current = freshLogs.find((log) => String(log.id) === String(logId))
                    if (current && current.status !== 'running') {
                        clearInterval(timer)
                        resolve(current)
                        return
                    }

                    if (Date.now() - startedAt > timeoutMs) {
                        clearInterval(timer)
                        reject(new Error('Islem zaman asimina ugradi (20 dk).'))
                    }
                } catch (err) {
                    clearInterval(timer)
                    reject(err)
                }
            }, 4000)
        }).finally(() => {
            clearBusy(universityKey)
        })
    }

    async function runScraper(universityKey) {
        const normalized = String(universityKey || 'ALL').toUpperCase()
        if (isRunning(normalized)) return

        markBusy(normalized)
        try {
            const { data } = await api.post('/scraper/start', { university_key: normalized })
            if (!data?.log_id) throw new Error('Scraper log kaydi olusturulamadi.')
            await waitForCompletion(data.log_id, normalized)
        } catch (err) {
            clearBusy(normalized)
            alert(err.response?.data?.error || err.message || 'Veri cekme baslatilamadi')
        }
    }

    async function runAll() {
        for (const uni of UNIVERSITIES) {
            await runScraper(uni.key)
        }
    }

    async function stopScraper(universityKey) {
        const normalized = String(universityKey || 'ALL').toUpperCase()
        try {
            await api.post('/scraper/stop', { university_key: normalized })
            clearBusy(normalized)
            await loadData(false)
        } catch (err) {
            alert(err.response?.data?.error || err.message || 'Veri cekme durdurulamadi')
        }
    }

    async function clearLogs() {
        if (!window.confirm('Calisan isler haric tum gecmisi silmek istiyor musunuz?')) return
        try {
            await api.post('/scraper/logs/clear')
            await loadData(true)
        } catch (err) {
            alert(err.response?.data?.error || err.message || 'Islemler temizlenemedi')
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    }

    return (
        <div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Veri Cekme</h1>
                    <p className="text-gray-400 mt-1">Kaynaklara gore scraper baslat, durdur ve son islemleri izle.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => loadData(true)} className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl transition-all">
                        <RefreshCw size={16} /> Yenile
                    </button>
                    <button onClick={clearLogs} className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl transition-all">
                        <Trash2 size={16} /> Son Islemleri Temizle
                    </button>
                    <button onClick={runAll} disabled={runningKeys.length > 0} className="flex items-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
                        <Download size={16} /> Tumunu Cek
                    </button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {[
                        { label: 'Universite', value: stats.universities },
                        { label: 'Bolum', value: stats.departments },
                        { label: 'Ders', value: stats.courses },
                        { label: 'Sinav', value: stats.exams },
                        { label: 'Soru', value: stats.questions },
                    ].map((item) => (
                        <div key={item.label} className="bg-dark-2 rounded-xl border border-white/5 p-4 text-center">
                            <div className="text-2xl font-bold">{item.value}</div>
                            <div className="text-xs text-gray-400 mt-1">{item.label}</div>
                        </div>
                    ))}
                </div>
            )}

            <h2 className="font-bold text-lg mb-4">Kaynaklar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {UNIVERSITIES.map((uni) => (
                    <div key={uni.key} className="bg-dark-2 rounded-2xl border border-white/5 p-6">
                        <div className="font-bold mb-2">{uni.name}</div>
                        <div className="text-sm text-gray-400 mb-4">Kaynak: {uni.key}</div>
                        {isRunning(uni.key) ? (
                            <button onClick={() => stopScraper(uni.key)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 font-semibold text-sm transition-all">
                                <Square size={14} /> Durdur
                            </button>
                        ) : (
                            <button onClick={() => runScraper(uni.key)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-sm transition-all">
                                <Play size={14} /> Baslat
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Son Islemler</h2>
                <div className="text-sm text-gray-500">Canli ilerleme, sure, soru ve hata bilgileri</div>
            </div>

            <div className="bg-dark-2 rounded-2xl border border-white/5 overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Durum</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Kaynak</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Baslangic</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Sure</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Asama</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Ilerleme</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Sorular</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Hatalar</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">Islem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => {
                            const meta = STATUS_META[log.status] || { label: log.status || '-', tone: 'text-gray-300' }
                            const errorText = log.error_message || log.last_error || (Number(log.errors_count || 0) > 0 ? `${log.errors_count} hata kaydi var` : '-')
                            return (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/[.02] align-top">
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center gap-2 text-sm font-medium ${meta.tone}`}>
                                            {statusIcon(log.status)}
                                            <span>{meta.label}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">{uniName(log.university_key)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-400">{new Date(log.created_at).toLocaleString('tr-TR')}</td>
                                    <td className="px-6 py-4 text-sm text-gray-300">{formatDuration(log.duration_seconds)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-300">
                                        <div>{stageText(log)}</div>
                                        {log.current_department && <div className="text-xs text-gray-500 mt-1">Bolum: {log.current_department}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">
                                        <div>{progressText(log)}</div>
                                        <div className="text-xs text-gray-500 mt-1">%{Number(log.department_progress_pct || 0)} bolum / %{Number(log.course_progress_pct || 0)} ders</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-300">
                                        <div>{questionText(log)}</div>
                                        <div className="text-xs text-gray-500 mt-1">{Number(log.questions_added || log.questions_saved || 0)} toplam yeni</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-red-400 max-w-sm break-words">{errorText}</td>
                                    <td className="px-6 py-4">
                                        {log.can_stop ? (
                                            <button onClick={() => stopScraper(log.university_key)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm font-medium transition-all">
                                                <Square size={14} /> Durdur
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-500">-</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan="9" className="text-center py-12 text-gray-400">Henuz islem yok.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
