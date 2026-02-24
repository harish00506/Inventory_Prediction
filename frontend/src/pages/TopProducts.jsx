import { useState, useEffect } from 'react'
import { getTopProducts } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { Award } from 'lucide-react'

const COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f43f5e', '#6366f1', '#ec4899']

export default function TopProducts() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getTopProducts()
            .then(r => { setItems(r.data.items || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top 10 Products</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Highest revenue generating products</p>
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Revenue by Product</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={items}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="product_name" tick={{ fontSize: 9, angle: -30, textAnchor: 'end' }} height={80} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                        <Bar dataKey="total_revenue" radius={[4, 4, 0, 0]} name="Revenue (₹)">
                            {items.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Award size={15} /> Product Rankings
                </h3>
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
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: COLORS[i] }}>
                                        {i + 1}
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
