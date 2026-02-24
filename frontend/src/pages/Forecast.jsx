import { useState, useEffect } from 'react'
import { getStores, getProducts, postForecast, postActualSales, postActualSalesPrevYears } from '../api/client'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Download, Search } from 'lucide-react'

export default function Forecast() {
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
    const [actualData, setActualData] = useState([])
    const [prevYearsData, setPrevYearsData] = useState([])
    const [comparePrevYears, setComparePrevYears] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        getStores().then(r => setStores(r.data.stores || [])).catch(() => { })
        getProducts().then(r => setProducts(r.data.products || [])).catch(() => { })
    }, [])

    const handleForecast = async () => {
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

            const forecastRes = await postForecast(body)
            let actualRes = { data: { daily: [] } }
            let prevYearsRes = { data: { daily: [] } }
            if (!channel) {
                actualRes = await postActualSales(body)
                if (comparePrevYears) {
                    prevYearsRes = await postActualSalesPrevYears(body)
                }
            }

            const selectedStoreId = storeId ? parseInt(storeId) : null
            const selectedProductId = productId ? parseInt(productId) : null
            const filteredDaily = (forecastRes.data.daily_forecasts || []).filter(row => {
                if (selectedStoreId && row.store_id !== selectedStoreId) return false
                if (selectedProductId && row.product_id !== selectedProductId) return false
                return true
            }).sort((a, b) => {
                const dateCompare = String(a.date).localeCompare(String(b.date))
                if (dateCompare !== 0) return dateCompare
                if (a.store_id !== b.store_id) return a.store_id - b.store_id
                return a.product_id - b.product_id
            })

            const summary = {
                total_quantity: Number(filteredDaily.reduce((acc, row) => acc + (row.predicted_quantity || 0), 0).toFixed(2)),
                total_revenue: Number(filteredDaily.reduce((acc, row) => acc + (row.predicted_revenue || 0), 0).toFixed(2)),
                days: new Set(filteredDaily.map(row => row.date)).size,
                products: new Set(filteredDaily.map(row => row.product_id)).size,
                stores: new Set(filteredDaily.map(row => row.store_id)).size,
            }

            setResult({
                ...forecastRes.data,
                daily_forecasts: filteredDaily,
                summary,
            })
            setActualData(actualRes.data.daily || [])
            setPrevYearsData(prevYearsRes.data.daily || [])
        } catch (err) {
            const status = err.response?.status
            if (status === 503 || status === 504) {
                setError('Request timed out on server. Reduce date range or choose a store/product filter.')
            } else {
                setError('Forecast failed: ' + (err.response?.data?.detail || err.message))
            }
        }
        setLoading(false)
    }

    // Helper: format unit label
    const fmtUnit = (val, unit) => {
        if (!val && val !== 0) return '-'
        const num = Number(val).toFixed(2)
        return unit === 'Kilogram' ? `${num} kg` : `${num} pcs`
    }

    // Merge forecast + actual into chart data
    const chartData = (() => {
        if (!result?.daily_forecasts) return []

        // Aggregate predicted data by date
        const predicted = {}
        result.daily_forecasts.forEach(item => {
            const d = item.date
            if (!predicted[d]) predicted[d] = { date: d, quantity: 0, lower: 0, upper: 0 }
            predicted[d].quantity += item.predicted_quantity
            predicted[d].lower += (item.lower_bound || 0)
            predicted[d].upper += (item.upper_bound || 0)
        })

        // Build actual data lookup
        const actuals = {}
        actualData.forEach(a => {
            actuals[a.date] = a
        })

        const prevYears = {}
        prevYearsData.forEach(item => {
            prevYears[item.date] = item
        })

        // Merge — all dates from predicted
        const allDates = Object.keys(predicted).sort()
        return allDates.map(d => ({
            ...predicted[d],
            range: Math.max(0, predicted[d].upper - predicted[d].lower),
            actual_qty: actuals[d]?.actual_quantity || null,
            prev_years_actual_qty: prevYears[d]?.actual_quantity_prev_years ?? null,
        }))
    })()

    const hasActual = chartData.some(d => d.actual_qty !== null)
    const hasPrevYearsActual = comparePrevYears && chartData.some(d => d.prev_years_actual_qty !== null)
    const selectedStore = storeId ? stores.find(s => String(s.store_id) === String(storeId)) : null
    const selectedProduct = productId ? products.find(p => String(p.product_id) === String(productId)) : null
    const selectedChannel = channel || 'All Channels'
    const productNameById = Object.fromEntries(products.map(p => [p.product_id, p.product_name]))

    const observedQuality = (() => {
        const comparable = chartData.filter(d => d.actual_qty !== null && d.actual_qty > 0)
        if (!comparable.length) {
            return { available: false, points: 0, mape: null, bias: null, coverage: null }
        }

        const mape = comparable.reduce((acc, d) => {
            const ape = Math.abs((d.actual_qty - d.quantity) / d.actual_qty)
            return acc + ape
        }, 0) / comparable.length * 100

        const bias = comparable.reduce((acc, d) => acc + (d.quantity - d.actual_qty), 0) / comparable.length
        const inBand = comparable.filter(d => d.actual_qty >= d.lower && d.actual_qty <= d.upper).length
        const coverage = (inBand / comparable.length) * 100

        return {
            available: true,
            points: comparable.length,
            mape,
            bias,
            coverage,
        }
    })()

    const downloadCSV = () => {
        if (!result?.daily_forecasts?.length) return
        const headers = 'Date,Store ID,Product ID,Unit,Predicted Qty,Lower Bound,Upper Bound,Revenue\n'
        const rows = result.daily_forecasts.map(r =>
            `${r.date},${r.store_id},${r.product_id},${r.unit || ''},${r.predicted_quantity},${r.lower_bound || ''},${r.upper_bound || ''},${r.predicted_revenue}`
        ).join('\n')
        const blob = new Blob([headers + rows], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `forecast_${startDate}_${endDate}.csv`
        a.click()
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sales Forecast</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Predict daily sales quantity with 80% prediction interval</p>
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
                            <option value="">Top 50 Products</option>
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
                    <button onClick={handleForecast} disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50">
                        {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Search size={14} />}
                        {loading ? 'Forecasting...' : 'Forecast'}
                    </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <input
                        id="compare-prev-years"
                        type="checkbox"
                        checked={comparePrevYears}
                        onChange={e => setComparePrevYears(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="compare-prev-years" className="text-xs text-gray-600 dark:text-gray-300">
                        Compare with previous years actual data (blue line)
                    </label>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>

            {/* Results */}
            {result && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Date: {startDate} to {endDate}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Store: {selectedStore ? selectedStore.store_name : 'All Stores'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Product: {selectedProduct ? selectedProduct.product_name : 'Top 50 Products'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Channel: {selectedChannel}
                        </span>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Qty</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.summary.total_quantity?.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Revenue</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">₹{result.summary.total_revenue?.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Days</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.summary.days}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Products</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.summary.products}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                            <button onClick={downloadCSV} className="flex items-center gap-1 text-teal-600 dark:text-teal-400 text-xs font-medium hover:underline">
                                <Download size={14} /> Download CSV
                            </button>
                        </div>
                    </div>

                    {observedQuality.available && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Observed MAPE</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{observedQuality.mape.toFixed(2)}%</p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Mean Bias</p>
                                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{observedQuality.bias.toFixed(2)}</p>
                            </div>
                            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3 border border-teal-200 dark:border-teal-800">
                                <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase">Interval Coverage</p>
                                <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{observedQuality.coverage.toFixed(1)}%</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Compared Days</p>
                                <p className="text-xl font-bold text-gray-700 dark:text-gray-200">{observedQuality.points}</p>
                            </div>
                        </div>
                    )}

                    {channel && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                            <p className="text-xs text-amber-700 dark:text-amber-300">Actual-vs-predicted comparison is shown only for All Channels mode.</p>
                        </div>
                    )}

                    {/* Chart with prediction interval + actual */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                            {hasActual ? 'Actual vs Predicted (with 80% Interval)' : 'Daily Forecast with 80% Prediction Interval'}
                        </h3>
                        <p className="text-xs text-gray-400 mb-3">
                            {hasActual
                                ? 'Red = actual values, Blue = previous year same-day actual, Teal = predicted median, Shaded = prediction interval'
                                : 'Shaded area = lower to upper bound (10th–90th percentile)'}
                        </p>
                        <ResponsiveContainer width="100%" height={320}>
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="qty" tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    formatter={(value, name) => {
                                        if (name === 'Prediction Interval (10th–90th)') return null
                                        const num = Number(value).toFixed(2)
                                        return [num, name]
                                    }}
                                />
                                <Legend />
                                <Area yAxisId="qty" type="monotone" dataKey="lower" stroke="none" fill="transparent" legendType="none" stackId="interval" />
                                <Area yAxisId="qty" type="monotone" dataKey="range" stroke="none" fill="#14b8a6" fillOpacity={0.15} stackId="interval" name="Prediction Interval (10th–90th)" />
                                <Line yAxisId="qty" type="monotone" dataKey="quantity" stroke="#14b8a6" strokeWidth={2} dot={false} name="Predicted Qty" />
                                <Line yAxisId="qty" type="monotone" dataKey="upper" stroke="#14b8a6" strokeWidth={1} strokeDasharray="4 2" dot={false} legendType="none" />
                                <Line yAxisId="qty" type="monotone" dataKey="lower" stroke="#14b8a6" strokeWidth={1} strokeDasharray="4 2" dot={false} legendType="none" />
                                {hasActual && (
                                    <Line yAxisId="qty" type="monotone" dataKey="actual_qty" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Actual Qty" connectNulls={false} />
                                )}
                                {hasPrevYearsActual && (
                                    <Line yAxisId="qty" type="monotone" dataKey="prev_years_actual_qty" stroke="#2563eb" strokeWidth={2} dot={false} name="Actual Qty (Prev Year)" connectNulls={false} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table with bounds and units */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Forecast Details</h3>
                        <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Date</th>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Store</th>
                                        <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product</th>
                                        <th className="p-2 text-center text-gray-500 dark:text-gray-400">Unit</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Lower</th>
                                        <th className="p-2 text-right text-teal-600 dark:text-teal-400 font-semibold">Predicted</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Upper</th>
                                        <th className="p-2 text-right text-gray-500 dark:text-gray-400">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.daily_forecasts.slice(0, 200).map((row, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{row.date}</td>
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{row.store_id}</td>
                                            <td className="p-2 text-gray-800 dark:text-gray-200">{productNameById[row.product_id] || `Product ${row.product_id}`}</td>
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.unit === 'Kilogram' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'}`}>
                                                    {row.unit === 'Kilogram' ? 'kg' : 'pcs'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtUnit(row.lower_bound, row.unit)}</td>
                                            <td className="p-2 text-right font-semibold text-teal-700 dark:text-teal-300">{fmtUnit(row.predicted_quantity, row.unit)}</td>
                                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{fmtUnit(row.upper_bound, row.unit)}</td>
                                            <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{row.predicted_revenue?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
