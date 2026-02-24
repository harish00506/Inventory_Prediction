import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Forecast from './pages/Forecast'
import Inventory from './pages/Inventory'
import Evaluation from './pages/Evaluation'
import ABCAnalysis from './pages/ABCAnalysis'
import TopProducts from './pages/TopProducts'
import Analysis from './pages/Analysis'
import OmniChannel from './pages/OmniChannel'

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/evaluation" element={<Evaluation />} />
                <Route path="/abc-analysis" element={<ABCAnalysis />} />
                <Route path="/top-products" element={<TopProducts />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/omnichannel" element={<OmniChannel />} />
            </Routes>
        </Layout>
    )
}
