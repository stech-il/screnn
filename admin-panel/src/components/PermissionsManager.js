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
  Alert
} from 'antd';
import {
  UserOutlined,
  DesktopOutlined,
  LockOutlined,
  UnlockOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons';
import api from '../utils/axios';

const { Title, Text } = Typography;
const { Option } = Select;

const PermissionsManager = () => {
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [form] = Form.useForm();

  const permissionTypes = [
    { value: 'read', label: 'קריאה', color: 'green' },
    { value: 'write', label: 'כתיבה', color: 'blue' },
    { value: 'admin', label: 'ניהול מלא', color: 'red' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  // ריל-טיים: האזן לשינויים והימנע מרענון דף
  useEffect(() => {
    const s = window.io;
    if (!s) return;
    const refresh = () => loadData();
    s.on('screen_name_updated', refresh);
    s.on('screen_logo_updated', refresh);
    s.on('screen_deleted', refresh);
    return () => {
      s.off('screen_name_updated', refresh);
      s.off('screen_logo_updated', refresh);
      s.off('screen_deleted', refresh);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [permissionsRes, usersRes, screensRes] = await Promise.all([
        api.get('/api/admin/permissions'),
        api.get('/api/admin/users'),
        api.get('/api/user/screens')
      ]);
      
      setPermissions(permissionsRes.data);
      setUsers(usersRes.data);
      setScreens(screensRes.data);
    } catch (error) {
      message.error('שגיאה בטעינת נתונים: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingPermission) {
        await api.put(`/api/admin/permissions/${editingPermission.id}`, values);
        message.success('ההרשאה עודכנה בהצלחה');
      } else {
        await api.post('/api/admin/permissions', values);
        message.success('ההרשאה נוספה בהצלחה');
      }

      setModalVisible(false);
      setEditingPermission(null);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('שגיאה בשמירת ההרשאה: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (permissionId) => {
    try {
      await api.delete(`/api/admin/permissions/${permissionId}`);
      message.success('ההרשאה נמחקה בהצלחה');
      loadData();
    } catch (error) {
      message.error('שגיאה במחיקת ההרשאה: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (permission) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      user_id: permission.user_id,
      screen_id: permission.screen_id,
      permission_type: permission.permission_type
    });
    setModalVisible(true);
  };

  const getPermissionTag = (type) => {
    const permType = permissionTypes.find(p => p.value === type);
    return (
      <Tag color={permType?.color || 'default'}>
        {permType?.label || type}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'משתמש',
      dataIndex: 'user_username',
      key: 'user',
      render: (username, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div style={{ fontWeight: 'bold' }}>{username}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.user_full_name}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'מסך',
      dataIndex: 'screen_name',
      key: 'screen',
      render: (screenName, record) => (
        <Space>
          <DesktopOutlined />
          <div>
            <div style={{ fontWeight: 'bold' }}>{screenName}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.screen_id}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'סוג הרשאה',
      dataIndex: 'permission_type',
      key: 'permission_type',
      render: (type) => getPermissionTag(type),
    },
    {
      title: 'נוצר בתאריך',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString('he-IL'),
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
            title="האם אתה בטוח שברצונך למחוק הרשאה זו?"
            onConfirm={() => handleDelete(record.id)}
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
            <LockOutlined style={{ marginLeft: 8 }} />
            ניהול הרשאות מסכים
          </Title>
          <Text type="secondary">
            ניהול גישה של משתמשים למסכים שונים במערכת
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPermission(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            הוסף הרשאה חדשה
          </Button>
        </Col>
      </Row>

      <Alert
        message="מידע חשוב"
        description="מנהלים (admin) יכולים לגשת לכל המסכים אוטומטית. הרשאות אלו מיועדות למשתמשים רגילים."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={permissions}
          loading={loading}
          rowKey="id"
          pagination={{
            total: permissions.length,
            pageSize: 10,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} מתוך ${total} הרשאות`,
          }}
        />
      </Card>

      <Modal
        title={editingPermission ? 'עריכת הרשאה' : 'הוספת הרשאה חדשה'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingPermission(null);
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
              {users
                .filter(user => user.role !== 'admin' && user.role !== 'super_admin')
                .map(user => (
                  <Option key={user.id} value={user.id}>
                    <Space>
                      <UserOutlined />
                      {user.username} - {user.full_name}
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="screen_id"
            label="מסך"
            rules={[{ required: true, message: 'נא לבחור מסך' }]}
          >
            <Select
              placeholder="בחר מסך"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {screens.map(screen => (
                <Option key={screen.id} value={screen.id}>
                  <Space>
                    <DesktopOutlined />
                    {screen.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="permission_type"
            label="סוג הרשאה"
            rules={[{ required: true, message: 'נא לבחור סוג הרשאה' }]}
          >
            <Select placeholder="בחר סוג הרשאה">
              {permissionTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  <Tag color={type.color}>{type.label}</Tag>
                  <span style={{ marginRight: 8 }}>
                    {type.value === 'read' && '- צפייה בתוכן בלבד'}
                    {type.value === 'write' && '- צפייה ועריכת תוכן'}
                    {type.value === 'admin' && '- גישה מלאה לניהול המסך'}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginTop: 24, textAlign: 'left' }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPermission ? 'עדכן הרשאה' : 'הוסף הרשאה'}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingPermission(null);
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

export default PermissionsManager;