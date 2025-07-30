import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Upload,
  Form,
  Input,
  Select,
  InputNumber,
  List,
  Typography,
  Space,
  message,
  Modal,
  Image,
  Tag,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ContentManager = ({ screenId, socket }) => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [form] = Form.useForm();
  const [uploadFile, setUploadFile] = useState(null);

  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/screens/${screenId}/content`);
      setContent(response.data);
    } catch (error) {
      message.error('שגיאה בטעינת התוכן');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (screenId) {
      loadContent();
    }
  }, [screenId]);

  useEffect(() => {
    if (!socket || !screenId) return;
    socket.on('content_updated', () => {
      loadContent();
    });
    return () => {
      socket.off('content_updated');
    };
  }, [socket, screenId]);

  const contentTypes = [
    { value: 'image', label: 'תמונה', icon: <FileImageOutlined /> },
    { value: 'video', label: 'סרטון', icon: <VideoCameraOutlined /> },
    { value: 'ad', label: 'פירסומת', icon: <FileImageOutlined /> },
    { value: 'code', label: 'קוד פתוח (HTML/CSS/JS)', icon: <CodeOutlined /> }
  ];

  const handleSubmit = async (values) => {
    try {
      const formData = new FormData();
      
      Object.keys(values).forEach(key => {
        if (values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
        }
      });

      if (uploadFile) {
        formData.append('file', uploadFile);
      }

      if (editingContent) {
        // Update existing content
        await axios.put(`/api/screens/${screenId}/content/${editingContent.id}`, formData);
        message.success('התוכן עודכן בהצלחה');
      } else {
        // Create new content
        await axios.post(`/api/screens/${screenId}/content`, formData);
        message.success('התוכן נוסף בהצלחה');
      }

      setModalVisible(false);
      setEditingContent(null);
      form.resetFields();
      setUploadFile(null);
      loadContent();
    } catch (error) {
      message.error('שגיאה בשמירת התוכן: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (contentId) => {
    try {
      await axios.delete(`/api/screens/${screenId}/content/${contentId}`);
      message.success('התוכן נמחק בהצלחה');
      loadContent();
    } catch (error) {
      message.error('שגיאה במחיקת התוכן');
    }
  };

  const handleEdit = (item) => {
    setEditingContent(item);
    form.setFieldsValue({
      type: item.type,
      title: item.title,
      content: item.content,
      display_duration: item.display_duration,
      order_index: item.order_index
    });
    setModalVisible(true);
  };

  const renderContentPreview = (item) => {
    switch (item.type) {
      case 'image':
      case 'ad':
        return item.file_path ? (
          <Image
            width={100}
            height={60}
            src={item.file_path}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
          />
        ) : (
          <div style={{ width: 100, height: 60, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
            <FileImageOutlined style={{ fontSize: 24, color: '#ccc' }} />
          </div>
        );
      case 'video':
        return (
          <div style={{ width: 100, height: 60, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
            <VideoCameraOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          </div>
        );
      case 'code':
        return (
          <div style={{ width: 100, height: 60, background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
            <CodeOutlined style={{ fontSize: 24, color: '#52c41a' }} />
          </div>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    const typeObj = contentTypes.find(t => t.value === type);
    return typeObj ? typeObj.label : type;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>ניהול תוכן ומדיה</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingContent(null);
            form.resetFields();
            setUploadFile(null);
            setModalVisible(true);
          }}
        >
          הוסף תוכן
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={content}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button key="edit" icon={<EditOutlined />} onClick={() => handleEdit(item)} />,
              <Popconfirm
                key="delete"
                title="האם אתה בטוח שברצונך למחוק תוכן זה?"
                onConfirm={() => handleDelete(item.id)}
                okText="כן"
                cancelText="לא"
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta
              avatar={renderContentPreview(item)}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{item.title || 'ללא כותרת'}</span>
                  <Tag color="blue">{getTypeLabel(item.type)}</Tag>
                  <Tag color="green">{item.display_duration / 1000}s</Tag>
                </div>
              }
              description={
                <div>
                  {item.content && (
                    <Paragraph 
                      ellipsis={{ rows: 2 }} 
                      style={{ marginBottom: 4 }}
                    >
                      {item.content}
                    </Paragraph>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    נוצר: {new Date(item.created_at).toLocaleDateString('he-IL')}
                  </Text>
                </div>
              }
            />
          </List.Item>
        )}
      />

      <Modal
        title={editingContent ? 'עריכת תוכן' : 'הוספת תוכן חדש'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingContent(null);
          form.resetFields();
          setUploadFile(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="type"
            label="סוג התוכן"
            rules={[{ required: true, message: 'נא לבחור סוג תוכן' }]}
          >
            <Select placeholder="בחר סוג תוכן">
              {contentTypes.map(type => (
                <Select.Option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="כותרת"
          >
            <Input placeholder="כותרת התוכן (אופציונלי)" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              
              if (type === 'code') {
                return (
                  <Form.Item
                    name="content"
                    label="קוד HTML/CSS/JavaScript"
                    rules={[{ required: true, message: 'נא להזין קוד' }]}
                  >
                    <TextArea 
                      rows={10}
                      placeholder="הכנס קוד HTML, CSS או JavaScript כאן..."
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                );
              } else if (type === 'image' || type === 'video' || type === 'ad') {
                return (
                  <Form.Item
                    label="קובץ"
                    required={!editingContent}
                  >
                    <Upload
                      beforeUpload={(file) => {
                        setUploadFile(file);
                        return false;
                      }}
                      maxCount={1}
                      accept={type === 'video' ? 'video/*' : 'image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.tiff,.ico'}
                    >
                      <Button icon={<UploadOutlined />}>
                        בחר {type === 'video' ? 'סרטון' : 'תמונה'}
                      </Button>
                    </Upload>
                    {editingContent && editingContent.file_path && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">קובץ נוכחי: {editingContent.file_path}</Text>
                      </div>
                    )}
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="display_duration"
            label="משך הצגה (מילישניות)"
            initialValue={5000}
          >
            <InputNumber
              min={1000}
              max={60000}
              step={1000}
              style={{ width: '100%' }}
              formatter={value => `${value / 1000}s`}
              parser={value => value.replace('s', '') * 1000}
            />
          </Form.Item>

          <Form.Item
            name="order_index"
            label="סדר הצגה"
            initialValue={0}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingContent ? 'עדכן' : 'הוסף'}
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

export default ContentManager; 