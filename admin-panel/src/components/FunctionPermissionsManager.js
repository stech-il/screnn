import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Form,
  Select,
  Typography,
  Space,
  message,
  Modal,
  Tag,
  Popconfirm,
  Row,
  Col,
  Alert,
  Checkbox
} from 'antd';
import {
  UserOutlined,
  ToolOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  GlobalOutlined,
  MessageOutlined,
  PictureOutlined
} from '@ant-design/icons';
import api from '../utils/axios';

const { Title, Text } = Typography;
const { Option } = Select;

const FunctionPermissionsManager = () => {
  const [userPermissions, setUserPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const functionTypes = [
    { 
      key: 'content_management', 
      label: 'ניהול תוכן', 
      icon: <FileTextOutlined />,
      color: 'blue',
      description: 'יצירה, עריכה ומחיקת תוכן'
    },
    { 
      key: 'rss_management', 
      label: 'ניהול RSS', 
      icon: <GlobalOutlined />,
      color: 'green',
      description: 'הוספה ועריכת מקורות חדשות'
    },
    { 
      key: 'messages_management', 
      label: 'ניהול הודעות רצות', 
      icon: <MessageOutlined />,
      color: 'orange',
      description: 'יצירה ועריכת הודעות רצות'
    },
    { 
      key: 'media_upload', 
      label: 'העלאת מדיה', 
      icon: <PictureOutlined />,
      color: 'purple',
      description: 'העלאת תמונות וסרטונים'
    },
    { 
      key: 'screen_settings', 
      label: 'הגדרות מסך', 
      icon: <SettingOutlined />,
      color: 'red',
      description: 'שינוי שם וגדרות מסך'
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, permissionsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/function-permissions')
      ]);
      
      setUsers(usersRes.data.filter(u => u.role !== 'admin' && u.role !== 'super_admin'));
      setUserPermissions(permissionsRes.data);
    } catch (error) {
      // If function-permissions endpoint doesn't exist, create empty array
      if (error.response?.status === 404) {
        setUserPermissions([]);
      } else {
        message.error('שגיאה בטעינת נתונים: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const { user_id, functions } = values;
      
      if (editingUser) {
        await api.put(`/api/admin/function-permissions/${editingUser.user_id}`, {
          functions
        });
        message.success('הרשאות הפונקציות עודכנו בהצלחה');
      } else {
        await api.post('/api/admin/function-permissions', {
          user_id,
          functions
        });
        message.success('הרשאות הפונקציות נוספו בהצלחה');
      }

      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('שגיאה בשמירת הרשאות: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/api/admin/function-permissions/${userId}`);
      message.success('הרשאות הפונקציות נמחקו בהצלחה');
      loadData();
    } catch (error) {
      message.error('שגיאה במחיקת הרשאות: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (userPermission) => {
    setEditingUser(userPermission);
    form.setFieldsValue({
      user_id: userPermission.user_id,
      functions: userPermission.functions || []
    });
    setModalVisible(true);
  };

  const getFunctionTags = (functions) => {
    if (!functions || functions.length === 0) {
      return <Tag color="default">אין הרשאות</Tag>;
    }
    
    return functions.map(func => {
      const funcType = functionTypes.find(f => f.key === func);
      return (
        <Tag key={func} color={funcType?.color || 'default'} style={{ marginBottom: 4 }}>
          {funcType?.icon} {funcType?.label || func}
        </Tag>
      );
    });
  };

  const columns = [
    {
      title: 'משתמש',
      dataIndex: 'username',
      key: 'user',
      render: (username, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div style={{ fontWeight: 'bold' }}>{username}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.full_name}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'הרשאות פונקציות',
      dataIndex: 'functions',
      key: 'functions',
      render: (functions) => (
        <div style={{ maxWidth: 400 }}>
          {getFunctionTags(functions)}
        </div>
      ),
    },
    {
      title: 'עודכן לאחרונה',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date) => date ? new Date(date).toLocaleDateString('he-IL') : '-',
    },
    {
      title: 'פעולות',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title="האם אתה בטוח שברצונך למחוק את כל הרשאות הפונקציות של משתמש זה?"
            onConfirm={() => handleDelete(record.user_id)}
            okText="כן"
            cancelText="לא"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2}>
            <ToolOutlined style={{ marginLeft: 8 }} />
            ניהול הרשאות פונקציות
          </Title>
          <Text type="secondary">
            ניהול גישה של משתמשים לפונקציות ספציפיות במערכת
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingUser(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            הוסף הרשאות פונקציות
          </Button>
        </Col>
      </Row>

      <Alert
        message="מידע חשוב"
        description="הרשאות אלו קובעות אילו פונקציות כל משתמש יכול לבצע במסכים שיש לו גישה אליהם. מנהלים יכולים לבצע את כל הפונקציות אוטומטית."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={userPermissions}
          loading={loading}
          rowKey="user_id"
          pagination={{
            total: userPermissions.length,
            pageSize: 10,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} מתוך ${total} משתמשים`,
          }}
        />
      </Card>

      <Modal
        title={editingUser ? 'עריכת הרשאות פונקציות' : 'הוספת הרשאות פונקציות'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {!editingUser && (
            <Form.Item
              name="user_id"
              label="משתמש"
              rules={[{ required: true, message: 'נא לבחור משתמש' }]}
            >
              <Select
                placeholder="בחר משתמש"
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
              >
                {users.map(user => (
                  <Option key={user.id} value={user.id}>
                    <Space>
                      <UserOutlined />
                      {user.username} - {user.full_name}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="functions"
            label="הרשאות פונקציות"
            rules={[{ required: true, message: 'נא לבחור לפחות הרשאה אחת' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                {functionTypes.map(func => (
                  <Col span={24} key={func.key}>
                    <Card size="small" style={{ marginBottom: 8 }}>
                      <Checkbox value={func.key}>
                        <Space>
                          {func.icon}
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{func.label}</div>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {func.description}
                            </Text>
                          </div>
                        </Space>
                      </Checkbox>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item style={{ marginTop: 24, textAlign: 'left' }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'עדכן הרשאות' : 'הוסף הרשאות'}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingUser(null);
                  form.resetFields();
                }}
              >
                ביטול
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FunctionPermissionsManager;
