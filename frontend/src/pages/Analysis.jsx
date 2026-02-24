import { useState } from 'react'
import { getTopProductsByDate, getBottomProductsByDate, getCustomerPortfolio } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Users, Search } from 'lucide-react'

const COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f43f5e', '#6366f1', '#ec4899']

const tabs = [
    { id: 'top', label: 'Top Products', icon: TrendingUp },
    { id: 'bottom', label: 'Bottom Products', icon: TrendingDown },
    { id: 'customers', label: 'Customer Portfolio', icon: Users },
]

export default function Analysis() {
    const [activeTab, setActiveTab] = useState('top')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [loading, setLoading] = useState(false)

    // Data states
    const [topItems, setTopItems] = useState([])
    const [bottomItems, setBottomItems] = useState([])
    const [customerData, setCustomerData] = useState(null)

    const handleLoad = async () => {
        if (!startDate || !endDate) return
        setLoading(true)

        try {
            if (activeTab === 'top') {
                const res = await getTopProductsByDate({ start_date: startDate, end_date: endDate })
                setTopItems(res.data.items || [])
            } else if (activeTab === 'bottom') {
                const res = await getBottomProductsByDate({ start_date: startDate, end_date: endDate })
                setBottomItems(res.data.items || [])
            } else {
                const res = await getCustomerPortfolio({ start_date: startDate, end_date: endDate })
                setCustomerData(res.data)
            }
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Product performance & customer insights by date range</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center
                            ${activeTab === tab.id
                                ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Date Picker + Load */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200"
                        />
                    </div>
                    <button
                        onClick={handleLoad}
                        disabled={!startDate || !endDate || loading}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        <Search size={14} />
                        {loading ? 'Loading...' : 'Load Data'}
                    </button>
                </div>
            </div>

            {/* Loading spinner */}
            {loading && (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
                </div>
            )}

            {/* Top Products Tab */}
            {activeTab === 'top' && !loading && topItems.length > 0 && (
                <ProductSection title="Top Performing Products" items={topItems} color="emerald" />
            )}

            {/* Bottom Products Tab */}
            {activeTab === 'bottom' && !loading && bottomItems.length > 0 && (
                <ProductSection title="Bottom Performing Products" items={bottomItems} color="red" />
            )}

            {/* Customer Portfolio Tab */}
            {activeTab === 'customers' && !loading && customerData && (
                <CustomerSection data={customerData} />
            )}

            {/* Empty state */}
            {!loading && activeTab === 'top' && topItems.length === 0 && (
                <EmptyState text="Select a date range and click Load Data to see top products" />
            )}
            {!loading && activeTab === 'bottom' && bottomItems.length === 0 && (
                <EmptyState text="Select a date range and click Load Data to see bottom products" />
            )}
            {!loading && activeTab === 'customers' && !customerData && (
                <EmptyState text="Select a date range and click Load Data to see customer portfolio" />
            )}
        </div>
    )
}


function ProductSection({ title, items, color }) {
    const borderColor = color === 'emerald' ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'
    const textColor = color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

    return (
        <div className="space-y-4">
            {/* Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <h3 className={`text-sm font-semibold mb-3 ${textColor}`}>{title} — Revenue</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={items}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="product_name" tick={{ fontSize: 9, angle: -25, textAnchor: 'end' }} height={70} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                        <Bar dataKey="total_revenue" radius={[4, 4, 0, 0]}>
                            {items.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border ${borderColor}`}>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Product Rankings</h3>
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-2 text-left text-gray-500 dark:text-gray-400">#</th>
                            <th className="p-2 text-left text-gray-500 dark:text-gray-400">Product</th>
                            <th className="p-2 text-right text-gray-500 dark:text-gray-400">Revenue (₹)</th>
                            <th className="p-2 text-right text-gray-500 dark:text-gray-400">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((row, i) => (
                            <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-2">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                                        {row.rank}
                                    </span>
                                </td>
                                <td className="p-2 text-gray-800 dark:text-gray-200 font-medium">{row.product_name}</td>
                                <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{row.total_revenue?.toLocaleString()}</td>
                                <td className="p-2 text-right text-gray-800 dark:text-gray-200">{row.total_quantity?.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}


function CustomerSection({ data }) {
    const { summary, top_customers, lost_customers } = data

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
                    <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase">Total Customers</p>
                    <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{summary.total_customers?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.total_orders?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Total Revenue</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">₹{summary.total_revenue?.toLocaleString() || 0}</p>
                </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                    <TrendingUp size={15} /> Top 10 Customers
                </h3>
                {top_customers.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">#</th>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">Customer Phone</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Orders</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Revenue (₹)</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {top_customers.map((c, i) => (
                                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                                            {c.rank}
                                        </span>
                                    </td>
                                    <td className="p-2 text-gray-800 dark:text-gray-200 font-medium">{c.customer_phone}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">{c.order_count}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{c.total_revenue?.toLocaleString()}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">{c.total_quantity?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-xs text-gray-400 text-center py-4">No customers found in this date range</p>
                )}
            </div>

            {/* Lost Customers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <TrendingDown size={15} /> Lost Customers (no orders in this period)
                </h3>
                {lost_customers.length > 0 ? (
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">Customer Phone</th>
                                <th className="p-2 text-left text-gray-500 dark:text-gray-400">Last Order</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Past Orders</th>
                                <th className="p-2 text-right text-gray-500 dark:text-gray-400">Past Revenue (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lost_customers.map((c, i) => (
                                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2 text-gray-800 dark:text-gray-200 font-medium">{c.customer_phone}</td>
                                    <td className="p-2 text-gray-800 dark:text-gray-200">{c.last_order_date}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">{c.past_orders}</td>
                                    <td className="p-2 text-right text-gray-800 dark:text-gray-200">₹{c.past_revenue?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-xs text-gray-400 text-center py-4">No lost customers found for this date range</p>
                )}
            </div>
        </div>
    )
}


function EmptyState({ text }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-10 border border-gray-100 dark:border-gray-700 text-center">
            <Search size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
        </div>
    )
}
