import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Switch, 
  Space, 
  message, 
  Popconfirm,
  Typography,
  Card,
  Tag
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  LockOutlined,
  MailOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const { Option } = Select;

const UserManagement = ({ socket }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (error) {
      message.error('שגיאה בטעינת משתמשים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('users_updated', () => {
      loadUsers();
    });
    return () => {
      socket.off('users_updated');
    };
  }, [socket]);

  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active === 1
    });
    setModalVisible(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      message.success('משתמש נמחק בהצלחה');
      loadUsers();
    } catch (error) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('שגיאה במחיקת משתמש');
      }
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        await axios.put(`/api/admin/users/${editingUser.id}`, {
          ...values,
          is_active: values.is_active ? 1 : 0
        });
        message.success('משתמש עודכן בהצלחה');
      } else {
        await axios.post('/api/admin/users', {
          ...values,
          is_active: values.is_active ? 1 : 0
        });
        message.success('משתמש נוצר בהצלחה');
      }
      setModalVisible(false);
      loadUsers();
    } catch (error) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('שגיאה בשמירת משתמש');
      }
    }
  };

  const columns = [
    {
      title: 'שם משתמש',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: 'שם מלא',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => (
        <Space>
          <IdcardOutlined />
          {text || '-'}
        </Space>
      )
    },
    {
      title: 'אימייל',
      dataIndex: 'email',
      key: 'email',
      render: (text) => (
        <Space>
          <MailOutlined />
          {text || '-'}
        </Space>
      )
    },
    {
      title: 'תפקיד',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? 'מנהל' : 'משתמש'}
        </Tag>
      )
    },
    {
      title: 'סטטוס',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive === 1 ? 'green' : 'red'}>
          {isActive === 1 ? 'פעיל' : 'לא פעיל'}
        </Tag>
      )
    },
    {
      title: 'תאריך יצירה',
      dataIndex: 'created_at',
      key: 'created_at',
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
            onClick={() => handleEditUser(record)}
          >
            ערוך
          </Button>
          <Popconfirm
            title="האם אתה בטוח שברצונך למחוק משתמש זה?"
            onConfirm={() => handleDeleteUser(record.id)}
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
            <UserOutlined /> ניהול משתמשים
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddUser}
            size="large"
          >
            הוסף משתמש
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} מתוך ${total} משתמשים`
          }}
        />

        <Modal
          title={editingUser ? 'ערוך משתמש' : 'הוסף משתמש חדש'}
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
              role: 'user',
              is_active: true
            }}
          >
            <Form.Item
              name="username"
              label="שם משתמש"
              rules={[{ required: true, message: 'אנא הכנס שם משתמש' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="שם משתמש" />
            </Form.Item>

            {!editingUser && (
              <Form.Item
                name="password"
                label="סיסמה"
                rules={[{ required: true, message: 'אנא הכנס סיסמה' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="סיסמה" />
              </Form.Item>
            )}

            {editingUser && (
              <Form.Item
                name="password"
                label="סיסמה חדשה (אופציונלי)"
              >
                <Input.Password prefix={<LockOutlined />} placeholder="השאר ריק אם לא רוצה לשנות" />
              </Form.Item>
            )}

            <Form.Item
              name="full_name"
              label="שם מלא"
            >
              <Input prefix={<IdcardOutlined />} placeholder="שם מלא" />
            </Form.Item>

            <Form.Item
              name="email"
              label="אימייל"
              rules={[
                { type: 'email', message: 'אנא הכנס אימייל תקין' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="אימייל" />
            </Form.Item>

            <Form.Item
              name="role"
              label="תפקיד"
              rules={[{ required: true, message: 'אנא בחר תפקיד' }]}
            >
              <Select>
                <Option value="admin">מנהל</Option>
                <Option value="user">משתמש</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="is_active"
              label="סטטוס"
              valuePropName="checked"
            >
              <Switch checkedChildren="פעיל" unCheckedChildren="לא פעיל" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {editingUser ? 'עדכן' : 'צור'}
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

export default UserManagement; 