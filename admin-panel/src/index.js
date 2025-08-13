import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import heIL from 'antd/locale/he_IL';
import App from './App';
import './index.css';
import axios from 'axios';

// Configure axios to include credentials for session management (baseURL now set via utils/axios)
axios.defaults.withCredentials = true;
delete axios.defaults.baseURL;

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
      <BrowserRouter basename="/admin">
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
); 