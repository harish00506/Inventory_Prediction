import { useMemo, useState } from 'react'
import { getOmnichannelOverview } from '../api/client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Network, Search, Truck } from 'lucide-react'

const COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b']

export default function OmniChannel() {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const loadOverview = async () => {
        setError('')
        setLoading(true)
        try {
            const params = {}
            if (startDate) params.start_date = startDate
            if (endDate) params.end_date = endDate
            const res = await getOmnichannelOverview(params)
            setResult(res.data)
        } catch (err) {
            setError('Failed to load omni-channel data: ' + (err.response?.data?.detail || err.message))
        }
        setLoading(false)
    }

    const topRows = useMemo(() => {
        if (!result?.top_products_by_channel) return []
        return result.top_products_by_channel.slice(0, 20)
    }, [result])

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Network size={20} /> Omni-Channel Control Tower
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unified visibility for Offline, E-Commerce, and Quick-Commerce channels</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                    <button onClick={loadOverview} disabled={loading}
                        className="md:col-span-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50">
                        <Search size={14} />
                        {loading ? 'Loading...' : 'Load Omni-Channel View'}
                    </button>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>

            {result && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <StatCard label="Orders" value={result.summary.orders?.toLocaleString()} />
                        <StatCard label="Quantity" value={result.summary.quantity?.toLocaleString()} />
                        <StatCard label="Revenue" value={`₹${result.summary.revenue?.toLocaleString()}`} />
                        <StatCard label="Channels" value={result.summary.channels} />
                        <StatCard label="Regions" value={result.summary.regions} />
                        <StatCard label="Stores" value={result.summary.stores} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Channel Revenue</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={result.channel_summary}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                                    <Bar dataKey="revenue" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Order Mix by Channel</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={result.channel_mix} dataKey="orders" nameKey="channel" cx="50%" cy="50%" outerRadius={90}>
                                        {result.channel_mix.map((entry, i) => <Cell key={entry.channel} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Orders']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Top Products by Channel</h3>
                        <div className="overflow-auto max-h-[380px]">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Channel</th>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Revenue</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRows.map((row, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{row.channel}</td>
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{row.product}</td>
                                            <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{row.revenue?.toLocaleString()}</td>
                                            <td className="p-2 text-right text-gray-800 dark:text-gray-200">{row.quantity?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <Truck size={15} /> Logistics Actions by Channel
                        </h3>
                        <div className="space-y-2">
                            {result.logistics_actions.map((item, i) => (
                                <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600">
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{item.channel} ({item.order_share_pct}%)</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.recommended_action}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ label, value }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? '-'}</p>
        </div>
    )
}
