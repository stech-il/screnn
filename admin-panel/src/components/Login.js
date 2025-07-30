import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const Login = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', values);
      message.success('התחברות מוצלחת!');
      onLoginSuccess(response.data.user);
    } catch (error) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('שגיאה בהתחברות');
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
            מערכת ניהול מסכים
          </Title>
          <Text type="secondary">התחבר למערכת הניהול</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'אנא הכנס שם משתמש' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="שם משתמש"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'אנא הכנס סיסמה' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="סיסמה"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<LoginOutlined />}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              התחבר
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ברירת מחדל: admin / admin123
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login; 