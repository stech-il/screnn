import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  List,
  Typography,
  Space,
  message,
  Modal,
  Tag,
  Popconfirm,
  Slider,
  Alert
} from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MessagesManager = ({ screenId, socket }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [form] = Form.useForm();
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewSpeed, setPreviewSpeed] = useState(50);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/screens/${screenId}/messages`);
      setMessages(response.data);
    } catch (error) {
      message.error('שגיאה בטעינת ההודעות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (screenId) {
      loadMessages();
    }
  }, [screenId]);

  useEffect(() => {
    if (!socket || !screenId) return;
    socket.on('content_updated', () => {
      loadMessages();
    });
    socket.on('messages_updated', () => {
      loadMessages();
    });
    return () => {
      socket.off('content_updated');
      socket.off('messages_updated');
    };
  }, [socket, screenId]);

  const handleSubmit = async (values) => {
    try {
      if (editingMessage) {
        await axios.put(`/api/screens/${screenId}/messages/${editingMessage.id}`, values);
        message.success('ההודעה עודכנה בהצלחה');
      } else {
        await axios.post(`/api/screens/${screenId}/messages`, values);
        message.success('ההודעה נוספה בהצלחה');
      }

      setModalVisible(false);
      setEditingMessage(null);
      form.resetFields();
      setPreviewMessage('');
      setPreviewSpeed(50);
      loadMessages();
    } catch (error) {
      message.error('שגיאה בשמירת ההודעה: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await axios.delete(`/api/screens/${screenId}/messages/${messageId}`);
      message.success('ההודעה נמחקה בהצלחה');
      loadMessages();
    } catch (error) {
      message.error('שגיאה במחיקת ההודעה');
    }
  };

  const handleEdit = (item) => {
    setEditingMessage(item);
    form.setFieldsValue({
      message: item.message,
      speed: item.speed
    });
    setPreviewMessage(item.message);
    setPreviewSpeed(item.speed);
    setModalVisible(true);
  };

  const toggleMessageStatus = async (messageId, currentStatus) => {
    try {
      await axios.patch(`/api/screens/${screenId}/messages/${messageId}`, {
        is_active: currentStatus ? 0 : 1
      });
      message.success(currentStatus ? 'ההודעה הושבתה' : 'ההודעה הופעלה');
      loadMessages();
    } catch (error) {
      message.error('שגיאה בעדכון סטטוס ההודעה');
    }
  };

  const getSpeedLabel = (speed) => {
    if (speed <= 20) return 'איטי';
    if (speed <= 40) return 'בינוני איטי';
    if (speed <= 60) return 'בינוני';
    if (speed <= 80) return 'מהיר';
    return 'מהיר מאוד';
  };

  const exampleMessages = [
    'ברוכים הבאים למוסד שלנו!',
    'אנא שימו לב לשעות הפעילות החדשות',
    'עדכון חשוב: החל מהשבוע הבא ישנם שינויים בלוח הזמנים',
    'תזכורת: אנא הקפידו על עמידה בכללי הבטיחות',
    'הודעה דחופה: ישיבת צוות בשעה 16:00'
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>ניהול הודעות רצות</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingMessage(null);
            form.resetFields();
            setPreviewMessage('');
            setPreviewSpeed(50);
            setModalVisible(true);
          }}
        >
          הוסף הודעה רצה
        </Button>
      </div>

      <Alert
        message="מה זה הודעות רצות?"
        description="הודעות רצות מופיעות בתחתית המסך או בחלקים אחרים שהוגדרו, והן נעות ברציפות מצד אחד למשנהו. אלו הודעות מושלמות לעדכונים חשובים או הודעות כלליות."
        type="info"
        style={{ marginBottom: 16 }}
        showIcon
      />

      <List
        loading={loading}
        dataSource={messages}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button 
                key="toggle"
                type={item.is_active ? "default" : "primary"}
                icon={item.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => toggleMessageStatus(item.id, item.is_active)}
              >
                {item.is_active ? 'השבת' : 'הפעל'}
              </Button>,
              <Button key="edit" icon={<EditOutlined />} onClick={() => handleEdit(item)} />,
              <Popconfirm
                key="delete"
                title="האם אתה בטוח שברצונך למחוק הודעה זו?"
                onConfirm={() => handleDelete(item.id)}
                okText="כן"
                cancelText="לא"
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta
              avatar={
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  background: item.is_active ? '#52c41a' : '#d9d9d9', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 16
                }}>
                  <MessageOutlined />
                </div>
              }
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.message}
                  </span>
                  {item.is_active ? (
                    <Tag color="green">פעיל</Tag>
                  ) : (
                    <Tag color="red">לא פעיל</Tag>
                  )}
                  <Tag color="blue">{getSpeedLabel(item.speed)}</Tag>
                </div>
              }
              description={
                <div>
                  <div style={{ 
                    background: '#001529', 
                    color: 'white', 
                    padding: '8px 12px', 
                    borderRadius: 4,
                    marginBottom: 8,
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div 
                      className="running-message" 
                      style={{ 
                        animation: `scroll ${10 / (item.speed / 50)}s linear infinite`,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.message}
                    </div>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    נוצר: {new Date(item.created_at).toLocaleDateString('he-IL')} | 
                    מהירות: {item.speed}/100
                  </Text>
                </div>
              }
            />
          </List.Item>
        )}
      />

      <Modal
        title={editingMessage ? 'עריכת הודעה רצה' : 'הוספת הודעה רצה חדשה'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingMessage(null);
          form.resetFields();
          setPreviewMessage('');
          setPreviewSpeed(50);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={(changedValues) => {
            if (changedValues.message !== undefined) {
              setPreviewMessage(changedValues.message);
            }
            if (changedValues.speed !== undefined) {
              setPreviewSpeed(changedValues.speed);
            }
          }}
        >
          <Form.Item
            name="message"
            label="תוכן ההודעה"
            rules={[
              { required: true, message: 'נא להזין תוכן ההודעה' },
              { min: 5, message: 'ההודעה חייבת להכיל לפחות 5 תווים' },
              { max: 200, message: 'ההודעה לא יכולה להכיל יותר מ-200 תווים' }
            ]}
          >
            <TextArea 
              rows={3}
              placeholder="הכנס את תוכן ההודעה הרצה כאן..."
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="speed"
            label={`מהירות התנועה: ${previewSpeed} (${getSpeedLabel(previewSpeed)})`}
            initialValue={50}
          >
            <Slider
              min={10}
              max={100}
              step={5}
              marks={{
                10: 'איטי',
                30: 'בינוני איטי',
                50: 'בינוני',
                70: 'מהיר',
                100: 'מהיר מאוד'
              }}
            />
          </Form.Item>

          {/* Preview */}
          {previewMessage && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>תצוגה מקדימה:</Text>
              <div style={{ 
                background: '#001529', 
                color: 'white', 
                padding: '12px', 
                borderRadius: 6,
                marginTop: 8,
                overflow: 'hidden',
                position: 'relative',
                minHeight: 40,
                display: 'flex',
                alignItems: 'center'
              }}>
                <div 
                  className="running-message" 
                  style={{ 
                    animation: `scroll ${10 / (previewSpeed / 50)}s linear infinite`,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {previewMessage}
                </div>
              </div>
            </div>
          )}

          {/* Example Messages */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>דוגמאות להודעות:</Text>
            <div style={{ marginTop: 8 }}>
              {exampleMessages.map((msg, index) => (
                <Tag
                  key={index}
                  style={{ 
                    marginBottom: 8, 
                    cursor: 'pointer',
                    display: 'block',
                    marginRight: 0,
                    padding: '4px 8px',
                    height: 'auto',
                    whiteSpace: 'normal',
                    lineHeight: 1.4
                  }}
                  onClick={() => {
                    form.setFieldValue('message', msg);
                    setPreviewMessage(msg);
                  }}
                >
                  {msg}
                </Tag>
              ))}
            </div>
          </div>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingMessage ? 'עדכן הודעה' : 'הוסף הודעה'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                ביטול
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MessagesManager; 