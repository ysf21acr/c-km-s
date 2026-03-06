import axios from 'axios'

const API_BASE = '/api/v1/admin'

// Get token from localStorage (shared with main site login)
function getToken() {
    return localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
}

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' }
})

// Add auth token to every request
api.interceptors.request.use(config => {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Handle auth errors
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('Auth error — invalid or missing admin token')
        }
        return Promise.reject(error)
    }
)

export default api
export { getToken }
