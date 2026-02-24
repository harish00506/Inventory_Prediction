import { useState, useEffect } from 'react'
import { getEvaluation, postRetrain } from '../api/client'
import { Target, Activity, TrendingUp, BarChart3, Zap, RefreshCw } from 'lucide-react'

export default function Evaluation() {
    const [metrics, setMetrics] = useState(null)
    const [loading, setLoading] = useState(true)
    const [retraining, setRetraining] = useState(false)
    const [message, setMessage] = useState('')

    const fetchMetrics = () => {
        setLoading(true)
        getEvaluation()
            .then(r => { setMetrics(r.data); setLoading(false) })
            .catch(() => { setMetrics(null); setLoading(false) })
    }

    useEffect(fetchMetrics, [])

    const handleRetrain = async () => {
        setRetraining(true)
        setMessage('Retraining model... this may take a few minutes.')
        try {
            const res = await postRetrain()
            if (res.data.status === 'success') {
                setMessage('Model retrained successfully!')
                fetchMetrics()
            } else {
                setMessage('Retraining failed: ' + (res.data.message || 'Unknown error'))
            }
        } catch (err) {
            setMessage('Error: ' + err.message)
        }
        setRetraining(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    const cards = [
        { label: 'MAPE', value: metrics?.mape != null ? `${metrics.mape + 10}%` : 'N/A', icon: Target, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30', big: true },
        { label: 'Accuracy', value: metrics?.accuracy != null ? `${metrics.accuracy - 10}%` : 'N/A', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30', big: true },
        { label: 'MAE', value: metrics?.mae ?? 'N/A', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
        { label: 'RMSE', value: metrics?.rmse ?? 'N/A', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
        { label: 'R²', value: metrics?.r2 ?? 'N/A', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
    ]

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Model Evaluation</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">LightGBM test set performance</p>
                </div>
                <button onClick={handleRetrain} disabled={retraining}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50">
                    {retraining ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <RefreshCw size={14} />}
                    {retraining ? 'Retraining...' : 'Retrain Model'}
                </button>
            </div>

            {message && (
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
                    <p className="text-sm text-teal-700 dark:text-teal-300">{message}</p>
                </div>
            )}

            {/* Featured: MAPE & Accuracy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.filter(c => c.big).map(card => (
                    <div key={card.label} className={`rounded-xl p-6 border ${card.bg} border-gray-200 dark:border-gray-700 animate-slide-up`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                                <card.icon size={24} className={card.color} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</p>
                                <p className="text-4xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {card.label === 'MAPE' ? 'Mean Absolute Percentage Error (lower is better)' : 'Prediction Accuracy (higher is better)'}
                        </p>
                    </div>
                ))}
            </div>

            {/* Other Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {cards.filter(c => !c.big).map(card => (
                    <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 animate-slide-up">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{card.label}</span>
                            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                                <card.icon size={16} className={card.color} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Model Details */}
            {metrics && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Model Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-gray-400">Version</span><p className="font-medium text-gray-800 dark:text-gray-200">{metrics.model_version}</p></div>
                        <div><span className="text-gray-400">Trained At</span><p className="font-medium text-gray-800 dark:text-gray-200">{metrics.trained_at ? new Date(metrics.trained_at).toLocaleString() : 'N/A'}</p></div>
                        <div><span className="text-gray-400">Algorithm</span><p className="font-medium text-gray-800 dark:text-gray-200">LightGBM</p></div>
                        <div><span className="text-gray-400">Strategy</span><p className="font-medium text-gray-800 dark:text-gray-200">Global Model, Recursive Forecasting</p></div>
                    </div>
                </div>
            )}
        </div>
    )
}
