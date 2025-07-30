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
  Switch,
  Divider,
  Collapse
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const RSSManager = ({ screenId, socket }) => {
  const [rssSources, setRssSources] = useState([]);
  const [rssContent, setRssContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [form] = Form.useForm();

  const loadRSSSources = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/screens/${screenId}/rss`);
      setRssSources(response.data);
    } catch (error) {
      message.error('שגיאה בטעינת מקורות RSS');
    } finally {
      setLoading(false);
    }
  };

  const loadRSSContent = async () => {
    try {
      setContentLoading(true);
      const response = await axios.get(`/api/screens/${screenId}/rss-content`);
      setRssContent(response.data);
    } catch (error) {
      message.error('שגיאה בטעינת תוכן RSS');
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    if (screenId) {
      loadRSSSources();
      loadRSSContent();
    }
  }, [screenId]);

  useEffect(() => {
    if (!socket || !screenId) return;
    socket.on('content_updated', () => {
      loadRSSSources();
      loadRSSContent();
    });
    socket.on('rss_updated', () => {
      loadRSSSources();
      loadRSSContent();
    });
    return () => {
      socket.off('content_updated');
      socket.off('rss_updated');
    };
  }, [socket, screenId]);

  const handleSubmit = async (values) => {
    try {
      if (editingSource) {
        await axios.put(`/api/screens/${screenId}/rss/${editingSource.id}`, values);
        message.success('מקור RSS עודכן בהצלחה');
      } else {
        await axios.post(`/api/screens/${screenId}/rss`, values);
        message.success('מקור RSS נוסף בהצלחה');
      }

      setModalVisible(false);
      setEditingSource(null);
      form.resetFields();
      loadRSSSources();
      loadRSSContent();
    } catch (error) {
      message.error('שגיאה בשמירת מקור RSS: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (sourceId) => {
    try {
      await axios.delete(`/api/screens/${screenId}/rss/${sourceId}`);
      message.success('מקור RSS נמחק בהצלחה');
      loadRSSSources();
      loadRSSContent();
    } catch (error) {
      message.error('שגיאה במחיקת מקור RSS');
    }
  };

  const handleEdit = (item) => {
    setEditingSource(item);
    form.setFieldsValue({
      name: item.name,
      url: item.url,
      refresh_interval: item.refresh_interval
    });
    setModalVisible(true);
  };

  const testRSSUrl = async (url) => {
    try {
      setContentLoading(true);
      const response = await axios.get(`/api/test-rss?url=${encodeURIComponent(url)}`);
      message.success(`RSS תקין! נמצאו ${response.data.items?.length || 0} פריטים`);
    } catch (error) {
      message.error('שגיאה בבדיקת RSS: ' + (error.response?.data?.error || error.message));
    } finally {
      setContentLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('he-IL');
    } catch {
      return 'תאריך לא תקין';
    }
  };

  const popularRSSFeeds = [
    { name: 'ידיעות אחרונות', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml' },
    { name: 'הארץ', url: 'https://www.haaretz.co.il/cmlink/1.1617539' },
    { name: 'מעריב', url: 'https://www.maariv.co.il/RSS/RSS.xml' },
    { name: 'כלכליסט', url: 'https://www.calcalist.co.il/GeneralRSS/0,16335,,00.xml' },
    { name: 'ספורט 5', url: 'https://www.sport5.co.il/RSS.aspx' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>ניהול חדשות RSS</Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadRSSContent}
            loading={contentLoading}
          >
            רענן תוכן
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingSource(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            הוסף מקור RSS
          </Button>
        </Space>
      </div>

      {/* RSS Sources List */}
      <Card title="מקורות RSS" style={{ marginBottom: 16 }}>
        <List
          loading={loading}
          dataSource={rssSources}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="edit" icon={<EditOutlined />} onClick={() => handleEdit(item)} />,
                <Popconfirm
                  key="delete"
                  title="האם אתה בטוח שברצונך למחוק מקור RSS זה?"
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
                    background: '#ff9500', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 16
                  }}>
                    <GlobalOutlined />
                  </div>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{item.name}</span>
                    <Tag color="orange">רענון כל {item.refresh_interval} דק'</Tag>
                    {item.is_active ? (
                      <Tag color="green">פעיל</Tag>
                    ) : (
                      <Tag color="red">לא פעיל</Tag>
                    )}
                  </div>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary">URL: </Text>
                      <Text code style={{ fontSize: 11 }}>{item.url}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      עודכן לאחרונה: {item.last_updated ? formatDate(item.last_updated) : 'אף פעם'}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* RSS Content Preview */}
      <Card title="תוכן RSS אחרון" extra={<Button icon={<ReloadOutlined />} onClick={loadRSSContent} loading={contentLoading} />}>
        <List
          loading={contentLoading}
          dataSource={rssContent.slice(0, 10)}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<GlobalOutlined style={{ fontSize: 16, color: '#1890ff' }} />}
                title={
                  <div>
                    <Text strong>{item.title}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color="blue" size="small">{item.source}</Tag>
                      <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                        {formatDate(item.pubDate)}
                      </Text>
                    </div>
                  </div>
                }
                description={
                  <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                    {item.description}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={editingSource ? 'עריכת מקור RSS' : 'הוספת מקור RSS'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingSource(null);
          form.resetFields();
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
            name="name"
            label="שם המקור"
            rules={[
              { required: true, message: 'נא להזין שם למקור RSS' },
              { min: 2, message: 'השם חייב להכיל לפחות 2 תווים' }
            ]}
          >
            <Input placeholder="לדוגמה: ידיעות אחרונות" />
          </Form.Item>

          <Form.Item
            name="url"
            label="URL של מקור RSS"
            rules={[
              { required: true, message: 'נא להזין URL' },
              { type: 'url', message: 'נא להזין URL תקין' }
            ]}
          >
            <Input 
              placeholder="https://example.com/rss.xml"
              addonAfter={
                <Button 
                  size="small" 
                  onClick={() => {
                    const url = form.getFieldValue('url');
                    if (url) testRSSUrl(url);
                  }}
                  loading={contentLoading}
                >
                  בדוק
                </Button>
              }
            />
          </Form.Item>

          <Form.Item
            name="refresh_interval"
            label="תדירות רענון (דקות)"
            initialValue={60}
          >
            <InputNumber
              min={5}
              max={1440}
              style={{ width: '100%' }}
              placeholder="60"
            />
          </Form.Item>

          {/* Popular RSS Feeds */}
          <Divider>מקורות RSS פופולריים</Divider>
          <div style={{ marginBottom: 16 }}>
            {popularRSSFeeds.map((feed, index) => (
              <Tag
                key={index}
                style={{ marginBottom: 8, cursor: 'pointer' }}
                onClick={() => {
                  form.setFieldsValue({
                    name: feed.name,
                    url: feed.url
                  });
                }}
              >
                {feed.name}
              </Tag>
            ))}
          </div>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingSource ? 'עדכן' : 'הוסף'}
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

export default RSSManager; 