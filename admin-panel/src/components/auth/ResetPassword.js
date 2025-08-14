import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/axios';

const { Title, Text } = Typography;

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      message.error('טוקן איפוס חסר');
    }
  }, [token]);

  const onFinish = async ({ password }) => {
    if (!token) return;
    setLoading(true);
    try {
      await api.post('/api/auth/reset', { token, password });
      message.success('הסיסמה אופסה, ניתן להתחבר');
      window.location.href = '/admin';
    } catch (e) {
      message.error(e.response?.data?.error || 'שגיאה באיפוס הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', padding: 16 }}>
      <Card style={{ width: 360, borderRadius: 12, border: '1px solid #15223b', background: '#0f1a30' }} bodyStyle={{ padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: '#e6f0ff', margin: 0 }}>איפוס סיסמה</Title>
          <Text style={{ color: '#9fb3c8' }}>הזן סיסמה חדשה</Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item name="password" label="סיסמה חדשה" rules={[{ required: true, message: 'אנא הזן סיסמה חדשה' }, { min: 6, message: 'לפחות 6 תווים' }]}>
            <Input.Password placeholder="סיסמה חדשה" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%', height: 44, borderRadius: 8 }}>אפס סיסמה</Button>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;


