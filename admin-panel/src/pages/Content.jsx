import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, Eye, X, Search, Upload } from 'lucide-react'

const treeData = [
    {
        id: 'u1', name: 'AUZEF', type: 'university', children: [
            {
                id: 'd1', name: 'Tıp Fakültesi', type: 'department', children: [
                    {
                        id: 'c1', name: 'Anatomi', type: 'course', children: [
                            { id: 'e1', name: '2023-2024 Güz Vize', type: 'exam', questions: 20 },
                            { id: 'e2', name: '2023-2024 Güz Final', type: 'exam', questions: 30 },
                            { id: 'e3', name: '2023-2024 Bahar Vize', type: 'exam', questions: 25 },
                        ]
                    },
                    {
                        id: 'c2', name: 'Fizyoloji', type: 'course', children: [
                            { id: 'e4', name: '2023-2024 Güz Vize', type: 'exam', questions: 18 },
                        ]
                    },
                ]
            },
            {
                id: 'd2', name: 'Eczacılık', type: 'department', children: [
                    {
                        id: 'c3', name: 'Farmakoloji', type: 'course', children: [
                            { id: 'e5', name: '2023-2024 Bahar Final', type: 'exam', questions: 22 },
                        ]
                    },
                ]
            },
        ]
    },
    {
        id: 'u2', name: 'Anadolu AÖF', type: 'university', children: [
            {
                id: 'd3', name: 'Hemşirelik', type: 'department', children: [
                    {
                        id: 'c4', name: 'Temel Hemşirelik', type: 'course', children: [
                            { id: 'e6', name: '2022-2023 Güz Vize', type: 'exam', questions: 15 },
                        ]
                    },
                ]
            },
        ]
    },
    {
        id: 'u3', name: 'Atatürk AÖF', type: 'university', children: [
            {
                id: 'd4', name: 'Diş Hekimliği', type: 'department', children: [
                    {
                        id: 'c5', name: 'Oral Patoloji', type: 'course', children: [
                            { id: 'e7', name: '2023-2024 Güz Final', type: 'exam', questions: 20 },
                        ]
                    },
                ]
            },
        ]
    },
]

const sampleQuestions = [
    { id: 'q1', text: 'Kalbin sağ ventrikülünden çıkan damar hangisidir?', options: ['Aorta', 'Pulmoner arter', 'Vena cava', 'Pulmoner ven'], correct: 1 },
    { id: 'q2', text: 'Karaciğerin en büyük lobu hangisidir?', options: ['Sol lob', 'Sağ lob', 'Kuadratus lobu', 'Kaudatus lobu'], correct: 1 },
    { id: 'q3', text: 'Böbreğin fonksiyonel birimi hangisidir?', options: ['Nefron', 'Glomerül', 'Tübül', 'Henle kulpu'], correct: 0 },
]

function TreeNode({ node, level = 0, onSelect }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = node.children && node.children.length > 0
    const colors = { university: 'text-primary', department: 'text-secondary', course: 'text-warning', exam: 'text-purple-400' }

    return (
        <div>
            <div className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors ${colors[node.type] || ''}`} style={{ paddingLeft: `${level * 20 + 12}px` }}
                onClick={() => { if (hasChildren) setOpen(!open); if (node.type === 'exam') onSelect(node) }}>
                {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div className="w-3.5" />}
                <span className="text-sm font-semibold">{node.name}</span>
                {node.questions !== undefined && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded ml-auto text-gray-400">{node.questions} soru</span>}
            </div>
            {open && hasChildren && node.children.map(child => <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} />)}
        </div>
    )
}

export default function Content() {
    const [selectedExam, setSelectedExam] = useState(null)
    const [questions, setQuestions] = useState(sampleQuestions)
    const [showAddQ, setShowAddQ] = useState(false)
    const [editQ, setEditQ] = useState(null)
    const [qForm, setQForm] = useState({ text: '', options: ['', '', '', ''], correct: 0 })
    const [previewQ, setPreviewQ] = useState(null)

    const openAddQ = () => { setEditQ(null); setQForm({ text: '', options: ['', '', '', ''], correct: 0 }); setShowAddQ(true) }
    const openEditQ = (q) => { setEditQ(q); setQForm({ text: q.text, options: [...q.options], correct: q.correct }); setShowAddQ(true) }

    const saveQ = () => {
        if (!qForm.text) return
        if (editQ) {
            setQuestions(prev => prev.map(q => q.id === editQ.id ? { ...q, ...qForm } : q))
        } else {
            setQuestions(prev => [...prev, { id: Date.now().toString(), ...qForm }])
        }
        setShowAddQ(false)
    }

    const deleteQ = (id) => setQuestions(prev => prev.filter(q => q.id !== id))

    return (
        <div>
            <h1 className="text-2xl font-black mb-8">İçerik Editörü</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tree */}
                <div className="glass-card p-4 lg:col-span-1 max-h-[70vh] overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Hiyerarşi</h2>
                    {treeData.map(node => <TreeNode key={node.id} node={node} onSelect={setSelectedExam} />)}
                </div>

                {/* Questions */}
                <div className="lg:col-span-2">
                    {selectedExam ? (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold">{selectedExam.name}</h2>
                                    <p className="text-sm text-gray-400">{questions.length} soru</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-ghost flex items-center gap-2 text-sm"><Upload size={14} /> Import</button>
                                    <button onClick={openAddQ} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Soru Ekle</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {questions.map((q, i) => (
                                    <div key={q.id} className="glass-card p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="text-sm font-bold mb-3"><span className="text-primary mr-2">S{i + 1}.</span>{q.text}</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {q.options.map((opt, oi) => (
                                                        <div key={oi} className={`text-xs px-3 py-2 rounded-lg ${oi === q.correct ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/5 text-gray-300'}`}>
                                                            <span className="font-bold mr-2">{String.fromCharCode(65 + oi)})</span>{opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button onClick={() => setPreviewQ(q)} className="p-1.5 hover:bg-blue-400/20 rounded-lg text-gray-400 hover:text-blue-400"><Eye size={14} /></button>
                                                <button onClick={() => openEditQ(q)} className="p-1.5 hover:bg-yellow-400/20 rounded-lg text-gray-400 hover:text-yellow-400"><Edit size={14} /></button>
                                                <button onClick={() => deleteQ(q.id)} className="p-1.5 hover:bg-red-400/20 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-12 text-center">
                            <Search size={48} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-400">Sol ağaçtan bir sınav seçin</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Question Modal */}
            {showAddQ && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddQ(false)}>
                    <div className="glass-card p-8 w-full max-w-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black">{editQ ? 'Soru Düzenle' : 'Yeni Soru'}</h2>
                            <button onClick={() => setShowAddQ(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-xs text-gray-400 font-bold mb-1 block">Soru Metni</label>
                                <textarea value={qForm.text} onChange={e => setQForm({ ...qForm, text: e.target.value })} rows={3} className="w-full bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" /></div>
                            {qForm.options.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <button onClick={() => setQForm({ ...qForm, correct: i })} className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${i === qForm.correct ? 'bg-secondary text-white' : 'bg-white/10 text-gray-400'}`}>{String.fromCharCode(65 + i)}</button>
                                    <input value={opt} onChange={e => { const newOpts = [...qForm.options]; newOpts[i] = e.target.value; setQForm({ ...qForm, options: newOpts }) }} className="flex-1 bg-dark/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder={`Seçenek ${String.fromCharCode(65 + i)}`} />
                                </div>
                            ))}
                            <p className="text-xs text-gray-500">Doğru cevabı seçmek için harfe tıklayın</p>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowAddQ(false)} className="btn-ghost flex-1">İptal</button>
                            <button onClick={saveQ} className="btn-primary flex-1">{editQ ? 'Güncelle' : 'Ekle'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewQ && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPreviewQ(null)}>
                    <div className="glass-card p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black mb-6">Soru Önizleme</h2>
                        <p className="text-sm mb-4 font-bold">{previewQ.text}</p>
                        <div className="space-y-2 mb-6">
                            {previewQ.options.map((o, i) => (
                                <div key={i} className={`px-4 py-3 rounded-xl text-sm ${i === previewQ.correct ? 'bg-secondary/20 text-secondary border border-secondary/30 font-bold' : 'bg-white/5 text-gray-300'}`}>
                                    {String.fromCharCode(65 + i)}) {o}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setPreviewQ(null)} className="btn-ghost w-full">Kapat</button>
                    </div>
                </div>
            )}
        </div>
    )
}
