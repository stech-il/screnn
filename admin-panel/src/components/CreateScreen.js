import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { PlusOutlined, DesktopOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;

const CreateScreen = ({ onScreenCreated, user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/screens', values);
      
      message.success(`מסך "${values.name}" נוצר בהצלחה!`);
      message.info(`מזהה המסך: ${response.data.id}`, 10);
      
      if (onScreenCreated) {
        await onScreenCreated();
      }
      
      // Navigate to the newly created screen
      navigate(`/screen/${response.data.id}`);
      
    } catch (error) {
      message.error('שגיאה ביצירת המסך: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Check if user has permission to create screens
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '50px' }}>
        <Title level={2} style={{ color: '#ff4d4f' }}>
          אין הרשאה
        </Title>
        <Text type="secondary">
          רק מנהלים יכולים ליצור מסכים חדשים במערכת
        </Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <PlusOutlined style={{ marginLeft: 8 }} />
          יצירת מסך חדש
        </Title>
        <Text type="secondary">
          צור מסך חדש במערכת ותקבל מזהה ייחודי לחיבור תוכנת Digitlex במחשב
        </Text>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="name"
            label="שם המסך"
            rules={[
              { required: true, message: 'נא להזין שם למסך' },
              { min: 2, message: 'שם המסך חייב להכיל לפחות 2 תווים' },
              { max: 50, message: 'שם המסך לא יכול להכיל יותר מ-50 תווים' }
            ]}
          >
            <Input 
              placeholder="לדוגמה: מסך כניסה ראשית"
              prefix={<DesktopOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="location"
            label="מיקום המסך"
            rules={[
              { max: 100, message: 'המיקום לא יכול להכיל יותר מ-100 תווים' }
            ]}
          >
            <Input 
              placeholder="לדוגמה: קומה 2, כניסה ראשית"
            />
          </Form.Item>

          <Form.Item
            name="logo_url"
            label="כתובת לוגו (אופציונלי)"
            rules={[
              { type: 'url', message: 'נא להזין כתובת URL תקינה' }
            ]}
          >
            <Input 
              placeholder="https://example.com/logo.png"
            />
          </Form.Item>

          <div style={{ 
            background: '#f0f8ff', 
            padding: 16, 
            borderRadius: 6, 
            marginBottom: 24,
            border: '1px solid #d6e4ff'
          }}>
            <Title level={5} style={{ color: '#1890ff', marginBottom: 8 }}>
              מה קורה אחרי יצירת המסך?
            </Title>
            <ul style={{ margin: 0, paddingRight: 20 }}>
              <li>תקבל מזהה ייחודי למסך</li>
              <li>תוכל להתחיל להוסיף תוכן (תמונות, סרטונים, חדשות)</li>
              <li>תוכל להתקין את תוכנת Digitlex במחשב ולהזין את המזהה</li>
              <li>המסך יתחיל להציג את התוכן שהגדרת</li>
            </ul>
          </div>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<PlusOutlined />}
                size="large"
              >
                צור מסך
              </Button>
              <Button 
                onClick={() => navigate('/')}
                icon={<ArrowRightOutlined />}
              >
                חזור לרשימה
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateScreen; 