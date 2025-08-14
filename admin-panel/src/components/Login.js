import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import api from '../utils/axios';

const { Title, Text } = Typography;

const Login = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      console.log('🔐 מנסה להתחבר עם:', values.username);
      const response = await api.post('/api/auth/login', values);
      console.log('✅ התחברות מוצלחת:', response.data);
      message.success('התחברות מוצלחת!');
      onLoginSuccess(response.data.user);
    } catch (error) {
      console.error('❌ שגיאה בהתחברות:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else if (error.code === 'ECONNREFUSED') {
        message.error('לא ניתן להתחבר לשרת. ודא שהשרת רץ.');
      } else {
        message.error('שגיאה בהתחברות - בדוק את החיבור לשרת');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0b1220',
      padding: 16
    }}>
      <Card
        style={{ width: 360, borderRadius: 12, border: '1px solid #15223b', background: '#0f1a30' }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: '#e6f0ff', margin: 0 }}>כניסה</Title>
          <Text style={{ color: '#9fb3c8' }}>פאנל ניהול Digitlex</Text>
        </div>

        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'אנא הכנס שם משתמש' }]}
            style={{ marginBottom: 12 }}>
            <Input prefix={<UserOutlined />} placeholder="שם משתמש" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'אנא הכנס סיסמה' }]} style={{ marginBottom: 12 }}>
            <Input.Password prefix={<LockOutlined />} placeholder="סיסמה" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} icon={<LoginOutlined />} style={{ width: '100%', height: 44, borderRadius: 8 }}>התחבר</Button>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Text style={{ color: '#6e86a0', fontSize: 12 }}>ברירת מחדל: admin / admin123</Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login; 