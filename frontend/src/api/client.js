import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_BASE })

// --- Stores & Products ---
export const getStores = () => api.get('/stores')
export const getProducts = () => api.get('/products')

// --- Forecast ---
export const postForecast = (data) => api.post('/forecast', data)

// --- Inventory ---
export const postInventory = (data) => api.post('/inventory', data)

// --- Evaluation ---
export const getEvaluation = () => api.get('/evaluation')

// --- Retrain ---
export const postRetrain = () => api.post('/retrain')

// --- Analysis ---
export const getABCAnalysis = () => api.get('/abc-analysis')
export const getTopProducts = () => api.get('/top-products')
export const getTopProductsByDate = (params) => api.get('/top-products-by-date', { params })
export const getBottomProductsByDate = (params) => api.get('/bottom-products-by-date', { params })
export const getCustomerPortfolio = (params) => api.get('/customer-portfolio', { params })
export const getOmnichannelOverview = (params) => api.get('/omnichannel-overview', { params })

// --- Actual Sales (for comparison) ---
export const postActualSales = (data) => api.post('/actual-sales', data)
export const postActualSalesPrevYears = (data) => api.post('/actual-sales-prev-years', data)

// --- Logs ---
export const getForecastLogs = () => api.get('/forecast-logs')

export default api
