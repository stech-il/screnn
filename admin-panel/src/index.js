import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import heIL from 'antd/locale/he_IL';
import App from './App';
import './index.css';
import axios from 'axios';

// Configure axios to include credentials for session management
axios.defaults.withCredentials = true;
axios.defaults.baseURL = 'http://localhost:3001';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider 
      locale={heIL}
      direction="rtl"
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          fontFamily: 'Arial Hebrew, Arial, sans-serif'
        }
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
); 