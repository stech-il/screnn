import axios from 'axios';
import { notification } from 'antd';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '',
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('🔄 Sending request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Response error:', error);
    
    if (error.response?.status === 401) {
      notification.error({
        message: 'שגיאת אימות',
        description: 'נדרש להתחבר מחדש',
        placement: 'topRight'
      });
      // Redirect to login if needed
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      notification.error({
        message: 'אין הרשאה',
        description: 'אין לך הרשאה לבצע פעולה זו',
        placement: 'topRight'
      });
    } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
      notification.error({
        message: 'שגיאת חיבור',
        description: 'לא ניתן להתחבר לשרת. ודא שהשרת רץ.',
        placement: 'topRight'
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;
