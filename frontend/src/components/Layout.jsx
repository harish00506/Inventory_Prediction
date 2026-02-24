import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard, TrendingUp, Package, BarChart3, Layers, Award, PieChart,
    Sun, Moon, Network
} from 'lucide-react'

const navLinks = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/forecast', label: 'Forecast', icon: TrendingUp },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/evaluation', label: 'Evaluation', icon: BarChart3 },
    { path: '/abc-analysis', label: 'ABC Analysis', icon: Layers },
    { path: '/top-products', label: 'Top Products', icon: Award },
    { path: '/analysis', label: 'Analysis', icon: PieChart },
    { path: '/omnichannel', label: 'Omni-Channel', icon: Network },
]

export default function Layout({ children }) {
    const [dark, setDark] = useState(() => {
        return localStorage.getItem('theme') === 'dark'
    })

    useEffect(() => {
        if (dark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }, [dark])

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-gray-900">
            {/* Header */}
            <header className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                        <TrendingUp size={18} className="text-white" />
                    </div>
                    <div className="leading-tight">
                        <h1 className="text-sm font-bold text-teal-600 dark:text-teal-400">ForecastAI</h1>
                        <p className="text-[9px] text-gray-400 dark:text-gray-500">Sales & Inventory</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex items-center gap-0.5 flex-1 min-w-0">
                    {navLinks.map(link => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.path === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap
                ${isActive
                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                }`
                            }
                        >
                            <link.icon size={14} />
                            <span className="hidden md:inline">{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Theme toggle */}
                <button
                    onClick={() => setDark(!dark)}
                    className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all duration-300"
                    title={dark ? 'Light Mode' : 'Dark Mode'}
                >
                    {dark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <a href="/" className="ml-4 flex items-center" aria-label="Home">
                    <img
                        src="/image.png"
                        alt="CortexCraft.AI"
                        className="h-14 w-auto object-contain"
                        onError={e => { e.target.style.display = 'none' }}
                    />
                </a>

            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>

            <footer className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
                    Disclaimer: This model is trained on only one year of data and may show anomalies.
                </p>
            </footer>
        </div>
    )
}
