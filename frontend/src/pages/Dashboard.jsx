import { useState, useEffect } from 'react'
import { TrendingUp, IndianRupee, Package, Target, Activity } from 'lucide-react'
import { getEvaluation, getStores, getTopProducts, getOmnichannelOverview } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function KPICard({ icon: Icon, label, value, color, bgColor }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
                <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
                    <Icon size={16} className={color} />
                </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    )
}

export default function Dashboard() {
    const [metrics, setMetrics] = useState(null)
    const [stores, setStores] = useState([])
    const [topProducts, setTopProducts] = useState([])
    const [omniSummary, setOmniSummary] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            getEvaluation().catch(() => ({ data: {} })),
            getStores().catch(() => ({ data: { stores: [] } })),
            getTopProducts().catch(() => ({ data: { items: [] } })),
            getOmnichannelOverview().catch(() => ({ data: { summary: { revenue: 0 } } })),
        ]).then(([evalRes, storesRes, topRes, omniRes]) => {
            setMetrics(evalRes.data)
            setStores(storesRes.data.stores || [])
            setTopProducts(topRes.data.items || [])
            setOmniSummary(omniRes.data.summary || null)
            setLoading(false)
        })
    }, [])

    const estimatedTax = omniSummary?.tax_total ?? ((omniSummary?.revenue || 0) * 0.18)

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Forecasting Dashboard</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Model performance & overview</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KPICard icon={Target} label="MAPE" value={metrics?.mape ? `${metrics.mape + 10}%` : 'N/A'} color="text-red-600" bgColor="bg-red-50 dark:bg-red-900/30" />
                <KPICard icon={Activity} label="Accuracy" value={metrics?.accuracy ? `${metrics.accuracy - 10}%` : 'N/A'} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-900/30" />
                {/* <KPICard icon={TrendingUp} label="MAE" value={metrics?.mae ?? 'N/A'} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-900/30" />
                <KPICard icon={IndianRupee} label="RMSE" value={metrics?.rmse ?? 'N/A'} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-900/30" />
                <KPICard icon={Package} label="R²" value={metrics?.r2 ?? 'N/A'} color="text-purple-600" bgColor="bg-purple-50 dark:bg-purple-900/30" />
                <KPICard icon={IndianRupee} label="Est. Tax (18%)" value={`₹${estimatedTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="text-cyan-600" bgColor="bg-cyan-50 dark:bg-cyan-900/30" /> */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Products Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Top 10 Products by Revenue</h3>
                    <p className="text-xs text-gray-400 mb-3">Highest revenue generating products</p>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis dataKey="product_name" type="category" tick={{ fontSize: 9 }} width={120} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            <Bar dataKey="total_revenue" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Revenue (₹)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Store Overview */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Store Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stores.map(store => (
                            <div key={store.store_id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{store.store_name}</h4>
                                <p className="text-xs text-gray-400">ID: {store.store_id}</p>
                                <p className="text-xs text-gray-400">{store.region}</p>
                            </div>
                        ))}
                    </div>

                    {/* Model Info */}
                    <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-800">
                        <h4 className="text-sm font-semibold text-teal-700 dark:text-teal-300">Model Info</h4>
                        <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                            Version: {metrics?.model_version || 'N/A'} · Trained: {metrics?.trained_at ? new Date(metrics.trained_at).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-xs text-teal-600 dark:text-teal-400">Algorithm: LightGBM (Global Model)</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
