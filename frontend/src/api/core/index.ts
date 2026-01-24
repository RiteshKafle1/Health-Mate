import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth tokens
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const role = localStorage.getItem('role');

        if (role === 'user') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.set('token', token);
            }
        } else if (role === 'doctor') {
            const dtoken = localStorage.getItem('dtoken');
            if (dtoken) {
                config.headers.set('dtoken', dtoken);
            }
        } else if (role === 'admin') {
            const atoken = localStorage.getItem('atoken');
            if (atoken) {
                config.headers.set('atoken', atoken);
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Clear auth data and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('dtoken');
            localStorage.removeItem('atoken');
            localStorage.removeItem('role');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
