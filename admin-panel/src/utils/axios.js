import axios from 'axios';
import { notification } from 'antd';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

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
    NProgress.start();
    console.log('🔄 Sending request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    NProgress.done();
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    NProgress.done();
    console.log('✅ Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    NProgress.done();
    console.error('❌ Response error:', error);
    
    if (error.response?.status === 401) {
      notification.error({
        message: 'שגיאת אימות',
        description: 'נדרש להתחבר מחדש',
        placement: 'topRight'
      });
      // הצגת מסך התחברות תתבצע על ידי האפליקציה; ננווט ל-/admin רק אם אנחנו מחוץ ל-/admin
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin';
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
