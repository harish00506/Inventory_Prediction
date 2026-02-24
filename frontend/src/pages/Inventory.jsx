import { useState, useEffect } from 'react'
import { getStores, getProducts, postInventory } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Package, Search, HelpCircle } from 'lucide-react'

export default function Inventory() {
    const MAX_UNFILTERED_DAYS = 31
    const channels = ['Offline', 'E-Commerce', 'Quick-Commerce']
    const [stores, setStores] = useState([])
    const [products, setProducts] = useState([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [storeId, setStoreId] = useState('')
    const [productId, setProductId] = useState('')
    const [channel, setChannel] = useState('')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const storeNameById = Object.fromEntries(stores.map(s => [String(s.store_id), s.store_name]))

    useEffect(() => {
        getStores().then(r => setStores(r.data.stores || [])).catch(() => { })
        getProducts().then(r => setProducts(r.data.products || [])).catch(() => { })
    }, [])

    const handleCompute = async () => {
        if (!startDate || !endDate) {
            setError('Please select start and end dates')
            return
        }
        if (new Date(endDate) < new Date(startDate)) {
            setError('End date must be the same as or after start date')
            return
        }
        const days = Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
        if (!storeId && !productId && days > MAX_UNFILTERED_DAYS) {
            setError(`For all stores and products, maximum range is ${MAX_UNFILTERED_DAYS} days. Select a store or product for larger ranges.`)
            return
        }
        setError('')
        setLoading(true)
        try {
            const body = { start_date: startDate, end_date: endDate }
            if (storeId) body.store_id = parseInt(storeId)
            if (productId) body.product_id = parseInt(productId)
            if (channel) body.channel = channel

            const invRes = await postInventory(body)
            setResult(invRes.data)
        } catch (err) {
            const status = err.response?.status
            if (status === 503 || status === 504) {
                setError('Request timed out on server. Reduce date range or choose a store/product filter.')
            } else {
                setError('Error: ' + (err.response?.data?.detail || err.message))
            }
        }
        setLoading(false)
    }

    // Build line chart data from result items
    const chartData = (() => {
        if (!result?.items?.length) return []
        return result.items.slice(0, 20).map(item => ({
            label: (storeNameById[String(item.store_id)] || `Store ${item.store_id}`),
            demand: item.predicted_demand,
            safety: item.safety_stock,
            required: item.required_inventory,
        }))
    })()

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inventory Requirements</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Find out how much stock you need to keep for each product</p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
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
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Store</label>
                        <select value={storeId} onChange={e => setStoreId(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">All Stores</option>
                            {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Product</label>
                        <select value={productId} onChange={e => setProductId(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">All Products</option>
                            {products.map(p => (
                                <option key={p.product_id} value={p.product_id}>
                                    {p.product_name} ({p.unit === 'Kilogram' ? 'kg' : 'pcs'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Channel</label>
                        <select value={channel} onChange={e => setChannel(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">All Channels</option>
                            {channels.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button onClick={handleCompute} disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50">
                        {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Search size={14} />}
                        {loading ? 'Computing...' : 'Compute'}
                    </button>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>

            {/* Results */}
            {result && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Date: {startDate} to {endDate}</span>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Channel: {channel || 'All Channels'}</span>
                    </div>

                    {/* Summary Cards with helper questions */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Expected Demand</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.summary.total_demand?.toLocaleString()}</p>
                            <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-1 flex items-start gap-1">
                                <HelpCircle size={11} className="mt-0.5 flex-shrink-0" />
                                How much will customers buy?
                            </p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Safety Stock</p>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{result.summary.total_safety_stock?.toLocaleString()}</p>
                            <p className="text-[11px] text-amber-500 dark:text-amber-400 mt-1 flex items-start gap-1">
                                <HelpCircle size={11} className="mt-0.5 flex-shrink-0" />
                                Extra stock to avoid running out
                            </p>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
                            <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase">Total Stock Needed</p>
                            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{result.summary.total_required?.toLocaleString()}</p>
                            <p className="text-[11px] text-teal-500 dark:text-teal-400 mt-1 flex items-start gap-1">
                                <HelpCircle size={11} className="mt-0.5 flex-shrink-0" />
                                How much to order in total?
                            </p>
                        </div>
                    </div>

                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-3 border border-cyan-200 dark:border-cyan-800">
                        <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase">Total Suggested Order Qty</p>
                        <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">{result.summary.total_suggested_order_qty?.toLocaleString() ?? 0}</p>
                    </div>

                    {/* Line Chart */}
                    {chartData.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Stock Needed by Store</h3>
                            <p className="text-xs text-gray-400 mb-3">Compare demand, safety buffer, and total stock across stores</p>
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 9, angle: -25, textAnchor: 'end' }} height={70} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                    <Legend />
                                    <Bar dataKey="demand" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Expected Demand" />
                                    <Bar dataKey="safety" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Safety Buffer" />
                                    <Bar dataKey="required" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Total Stock Needed" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {chartData.length === 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Single Product View</h3>
                            <p className="text-xs text-gray-400">A chart is hidden for single-product selection. Use the summary cards and details table below for exact values.</p>
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <Package size={15} /> Inventory Details
                        </h3>
                        <div className="overflow-auto max-h-[500px]">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Store</th>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product</th>
                                        <th className="p-2 text-center text-gray-500 dark:text-gray-400">ABC</th>
                                        <th className="p-2 text-center text-gray-500 dark:text-gray-400">Unit</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Demand</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Safety Buffer</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Reorder Point</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Suggested Qty</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Total Needed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.items.slice(0, 200).map((row, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{storeNameById[String(row.store_id)] || `Store ${row.store_id}`}</td>
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{row.product_name}</td>
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.abc_class === 'A' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : row.abc_class === 'B' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                    {row.abc_class}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.unit === 'Kilogram' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}`}>
                                                    {row.unit === 'Kilogram' ? 'kg' : 'pcs'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right text-gray-800 dark:text-gray-200">{row.predicted_demand?.toFixed(2)}</td>
                                            <td className="p-2 text-right text-amber-600 font-medium">{row.safety_stock?.toFixed(2)}</td>
                                            <td className="p-2 text-right text-blue-600 font-medium">{row.reorder_point?.toFixed(2)}</td>
                                            <td className="p-2 text-right text-cyan-600 font-medium">{row.suggested_order_qty?.toFixed(2)}</td>
                                            <td className="p-2 text-right text-teal-600 font-bold">{row.required_inventory?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Simple explanation */}
                    <div className="bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <HelpCircle size={14} /> How to read this page
                        </h4>
                        <ul className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
                            <li><strong>Expected Demand</strong> — How many units customers are likely to buy during this period</li>
                            <li><strong>Safety Buffer</strong> — Extra stock kept aside so you don't run out unexpectedly</li>
                            <li><strong>Total Stock Needed</strong> — Demand + Safety Buffer = what you should actually order</li>
                            <li><strong>Reorder Point</strong> — When stock falls near this level, place a replenishment order</li>
                            <li><strong>Suggested Qty</strong> — Dynamic recommended order quantity for the next review cycle</li>
                            <li><strong>ABC Class</strong> — A-items get higher service targets, so they keep higher safety stock</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    )
}
