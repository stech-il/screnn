import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import api from '../../utils/axios';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);

  const onFinish = async ({ email }) => {
    setLoading(true);
    try {
      await api.post('/api/auth/forgot', { email });
      message.success('אם המייל קיים, נשלחה הודעת איפוס');
    } catch (e) {
      message.success('אם המייל קיים, נשלחה הודעת איפוס');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', padding: 16 }}>
      <Card style={{ width: 360, borderRadius: 12, border: '1px solid #15223b', background: '#0f1a30' }} bodyStyle={{ padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ color: '#e6f0ff', margin: 0 }}>שכחתי סיסמה</Title>
          <Text style={{ color: '#9fb3c8' }}>נשלח קישור איפוס למייל</Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item name="email" label="אימייל" rules={[{ required: true, type: 'email', message: 'אנא הזן אימייל תקין' }]}>
            <Input placeholder="example@mail.com" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%', height: 44, borderRadius: 8 }}>שלח קישור איפוס</Button>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPassword;


