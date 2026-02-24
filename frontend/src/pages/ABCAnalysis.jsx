import { useState, useEffect } from 'react'
import { getABCAnalysis } from '../api/client'
import { Layers } from 'lucide-react'

const classColors = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    C: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function ABCAnalysis() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('ALL')

    useEffect(() => {
        getABCAnalysis()
            .then(r => { setData(r.data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    const items = data?.items || []
    const summary = data?.summary || {}
    const filtered = filter === 'ALL' ? items : items.filter(i => i.abc_class === filter)

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">ABC Analysis</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Products classified by revenue contribution</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-lg transition-all" onClick={() => setFilter(filter === 'A' ? 'ALL' : 'A')}>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Class A (0-70%)</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summary.A_count || 0}</p>
                    <p className="text-xs text-emerald-500">High-value products</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-lg transition-all" onClick={() => setFilter(filter === 'B' ? 'ALL' : 'B')}>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Class B (70-90%)</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{summary.B_count || 0}</p>
                    <p className="text-xs text-amber-500">Medium-value products</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 cursor-pointer hover:shadow-lg transition-all" onClick={() => setFilter(filter === 'C' ? 'ALL' : 'C')}>
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Class C (90-100%)</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{summary.C_count || 0}</p>
                    <p className="text-xs text-red-500">Low-value products</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_products || 0}</p>
                    <p className="text-xs text-gray-400">Click a class to filter</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Layers size={15} /> {filter === 'ALL' ? 'All Products' : `Class ${filter} Products`}
                    {filter !== 'ALL' && (
                        <button onClick={() => setFilter('ALL')} className="text-teal-500 text-xs hover:underline ml-2">Show All</button>
                    )}
                </h3>
                <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product ID</th>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product Name</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Revenue (₹)</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Cumulative %</th>
                                <th className="p-2 text-center text-gray-500 dark:text-gray-400">Class</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 300).map((row, i) => (
                                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2 text-gray-800 dark:text-gray-200">{row.product_id}</td>
                                    <td className="p-2 text-gray-800 dark:text-gray-200">{row.product_name}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{row.total_revenue?.toLocaleString()}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">{row.cumulative_pct}%</td>
                                    <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${classColors[row.abc_class]}`}>
                                            {row.abc_class}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
