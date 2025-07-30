import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Select, 
  Space, 
  message, 
  Popconfirm,
  Typography,
  Card,
  Tag,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  DesktopOutlined,
  KeyOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const { Option } = Select;

const PermissionsManager = ({ socket }) => {
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [permissionsRes, usersRes, screensRes] = await Promise.all([
        axios.get('/api/admin/permissions'),
        axios.get('/api/admin/users'),
        axios.get('/api/user/screens')
      ]);
      
      setPermissions(permissionsRes.data);
      setUsers(usersRes.data);
      setScreens(screensRes.data);
    } catch (error) {
      message.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('permissions_updated', () => {
      loadData();
    });
    return () => {
      socket.off('permissions_updated');
    };
  }, [socket]);

  const handleAddPermission = () => {
    setEditingPermission(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditPermission = (permission) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      user_id: permission.user_id,
      screen_id: permission.screen_id,
      permission_type: permission.permission_type
    });
    setModalVisible(true);
  };

  const handleDeletePermission = async (permissionId) => {
    try {
      await axios.delete(`/api/admin/permissions/${permissionId}`);
      message.success('הרשאה נמחקה בהצלחה');
      loadData();
    } catch (error) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('שגיאה במחיקת הרשאה');
      }
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingPermission) {
        await axios.put(`/api/admin/permissions/${editingPermission.id}`, {
          permission_type: values.permission_type
        });
        message.success('הרשאה עודכנה בהצלחה');
      } else {
        await axios.post('/api/admin/permissions', values);
        message.success('הרשאה נוצרה בהצלחה');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('שגיאה בשמירת הרשאה');
      }
    }
  };

  const getPermissionColor = (type) => {
    switch (type) {
      case 'admin': return 'red';
      case 'write': return 'orange';
      case 'read': return 'green';
      default: return 'blue';
    }
  };

  const getPermissionText = (type) => {
    switch (type) {
      case 'admin': return 'מנהל';
      case 'write': return 'כתיבה';
      case 'read': return 'קריאה';
      default: return type;
    }
  };

  const columns = [
    {
      title: 'משתמש',
      key: 'user',
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div>{record.user_full_name || record.user_username}</div>
            <small style={{ color: '#666' }}>{record.user_username}</small>
          </div>
        </Space>
      )
    },
    {
      title: 'מסך',
      key: 'screen',
      render: (_, record) => (
        <Space>
          <DesktopOutlined />
          {record.screen_name}
        </Space>
      )
    },
    {
      title: 'הרשאה',
      dataIndex: 'permission_type',
      key: 'permission_type',
      render: (type) => (
        <Tag color={getPermissionColor(type)}>
          {getPermissionText(type)}
        </Tag>
      )
    },
    {
      title: 'ניתן על ידי',
      key: 'granted_by',
      render: (_, record) => (
        <span>{record.granted_by_username || '-'}</span>
      )
    },
    {
      title: 'תאריך מתן הרשאה',
      dataIndex: 'granted_at',
      key: 'granted_at',
      render: (date) => new Date(date).toLocaleDateString('he-IL')
    },
    {
      title: 'פעולות',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditPermission(record)}
          >
            ערוך
          </Button>
          <Popconfirm
            title="האם אתה בטוח שברצונך למחוק הרשאה זו?"
            onConfirm={() => handleDeletePermission(record.id)}
            okText="כן"
            cancelText="לא"
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              מחק
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <KeyOutlined /> ניהול הרשאות משתמשים
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddPermission}
            size="large"
          >
            הוסף הרשאה
          </Button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Tag color="green">קריאה - צפייה בתוכן</Tag>
            <Tag color="orange">כתיבה - עריכת תוכן</Tag>
            <Tag color="red">מנהל - שליטה מלאה</Tag>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} מתוך ${total} הרשאות`
          }}
        />

        <Modal
          title={editingPermission ? 'ערוך הרשאה' : 'הוסף הרשאה חדשה'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              permission_type: 'read'
            }}
          >
            {!editingPermission && (
              <>
                <Form.Item
                  name="user_id"
                  label="משתמש"
                  rules={[{ required: true, message: 'אנא בחר משתמש' }]}
                >
                  <Select placeholder="בחר משתמש">
                    {users.map(user => (
                      <Option key={user.id} value={user.id}>
                        {user.full_name || user.username} ({user.username})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="screen_id"
                  label="מסך"
                  rules={[{ required: true, message: 'אנא בחר מסך' }]}
                >
                  <Select placeholder="בחר מסך">
                    {screens.map(screen => (
                      <Option key={screen.id} value={screen.id}>
                        {screen.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            <Form.Item
              name="permission_type"
              label="סוג הרשאה"
              rules={[{ required: true, message: 'אנא בחר סוג הרשאה' }]}
            >
              <Select>
                <Option value="read">
                  <Tag color="green">קריאה</Tag> - צפייה בתוכן
                </Option>
                <Option value="write">
                  <Tag color="orange">כתיבה</Tag> - עריכת תוכן
                </Option>
                <Option value="admin">
                  <Tag color="red">מנהל</Tag> - שליטה מלאה
                </Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {editingPermission ? 'עדכן' : 'צור'}
                </Button>
                <Button onClick={() => setModalVisible(false)}>
                  ביטול
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default PermissionsManager; 