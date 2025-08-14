import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import api from '../utils/axios';

const { Title, Text } = Typography;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/admin/settings');
        form.setFieldsValue(res.data || {});
      } catch (e) {
        message.error('שגיאה בטעינת הגדרות');
      }
    })();
  }, [form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await api.post('/api/admin/settings', values);
      message.success('הגדרות נשמרו');
    } catch (e) {
      message.error('שגיאה בשמירת הגדרות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={3}>הגדרות מערכת</Title>
      <Text type="secondary">נהל כאן את הגדרות ה־PUBLIC_URL וה־SMTP לשחזור סיסמה</Text>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
        <Form.Item name="PUBLIC_URL" label="PUBLIC_URL">
          <Input placeholder="https://screnn.onrender.com" />
        </Form.Item>
        <Form.Item name="SMTP_USER" label="SMTP_USER">
          <Input placeholder="gmail-user@gmail.com" />
        </Form.Item>
        <Form.Item name="SMTP_PASS" label="SMTP_PASS">
          <Input.Password placeholder="App Password" />
        </Form.Item>
        <Form.Item name="SMTP_FROM" label="SMTP_FROM">
          <Input placeholder="from@example.com" />
        </Form.Item>
        <Form.Item name="DATA_DIR" label="DATA_DIR">
          <Input placeholder="/opt/render/project/src/data" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>שמור</Button>
      </Form>
    </Card>
  );
};

export default Settings;


