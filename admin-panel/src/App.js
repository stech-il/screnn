import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Space, notification, Button, Dropdown, Avatar } from 'antd';
import { 
  DesktopOutlined, 
  PlusOutlined, 
  SettingOutlined,
  DashboardOutlined,
  FileImageOutlined,
  GlobalOutlined,
  MessageOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  KeyOutlined
} from '@ant-design/icons';
import api from './utils/axios';

import ScreensList from './components/ScreensList';
import ScreenDetail from './components/ScreenDetail';
import CreateScreen from './components/CreateScreen';
import Login from './components/Login';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import UserManagement from './components/UserManagement';
import PermissionsManager from './components/PermissionsManager';
import FunctionPermissionsManager from './components/FunctionPermissionsManager';
import socket from './components/socket';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Check authentication status on app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 בודק אימות משתמש...');
      const response = await api.get('/api/auth/me');
      console.log('✅ משתמש מחובר:', response.data.user);
      setUser(response.data.user);
    } catch (error) {
      console.log('❌ משתמש לא מחובר:', error.message);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      navigate('/');
      notification.success({
        message: 'התנתקות מוצלחת',
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'שגיאה בהתנתקות',
        placement: 'topRight'
      });
    }
  };

  const loadScreens = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/user/screens');
      setScreens(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        navigate('/');
      } else {
        notification.error({
          message: 'שגיאה',
          description: 'שגיאה בטעינת רשימת המסכים',
          placement: 'topRight'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadScreens();
    }
  }, [user]);

  // Socket listeners לעדכון בזמן אמת
  useEffect(() => {
    if (!socket || !user) return;

    console.log('🔌 הגדרת Socket listeners בזמן אמת...');

    // עדכון סטטוס מסכים בזמן אמת (last_seen)
    socket.on('screen_status_updated', (data) => {
      console.log('📡 screen_status_updated received:', data);
      setScreens(prevScreens => 
        prevScreens.map(screen => 
          screen.id === data.id 
            ? { ...screen, last_seen: data.last_seen }
            : screen
        )
      );
    });

    // עדכון מסכים שנמחקו
    socket.on('screen_deleted', (data) => {
      console.log('📡 screen_deleted received:', data);
      setScreens(prevScreens => 
        prevScreens.filter(screen => screen.id !== data.id)
      );
    });

    // עדכון שם מסך
    socket.on('screen_name_updated', (data) => {
      console.log('📡 screen_name_updated received:', data);
      setScreens(prevScreens => 
        prevScreens.map(screen => 
          screen.id === data.id 
            ? { ...screen, name: data.name }
            : screen
        )
      );
    });

    // עדכון לוגו מסך
    socket.on('screen_logo_updated', (data) => {
      console.log('📡 screen_logo_updated received:', data);
      setScreens(prevScreens => 
        prevScreens.map(screen => 
          screen.id === data.id 
            ? { ...screen, logo_url: data.logo_url }
            : screen
        )
      );
    });

    // עדכון כללי של תוכן
    socket.on('content_updated', () => {
      console.log('📡 content_updated received - רענון מסכים');
      loadScreens(); // רק למקרים כלליים
    });

    return () => {
      console.log('🔌 ניקוי Socket listeners...');
      socket.off('screen_status_updated');
      socket.off('screen_deleted');
      socket.off('screen_name_updated');
      socket.off('screen_logo_updated');
      socket.off('content_updated');
    };
  }, [socket, user]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <Title level={2} style={{ color: 'white' }}>טוען...</Title>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'דף הבית'
    },
    {
      key: '/create',
      icon: <PlusOutlined />,
      label: 'יצירת מסך חדש'
    },
    {
      key: 'screens',
      icon: <DesktopOutlined />,
      label: 'מסכים',
      children: screens.map(screen => ({
        key: `/screen/${screen.id}`,
        label: screen.name,
        icon: <div className={`status-indicator ${screen.last_seen ? 'status-online' : 'status-offline'}`} />
      }))
    }
  ];

  // Add admin menu items
  if (user.role === 'admin' || user.role === 'super_admin') {
    menuItems.push({
      key: '/users',
      icon: <TeamOutlined />,
      label: 'ניהול משתמשים'
    });
    
    menuItems.push({
      key: '/permissions',
      icon: <KeyOutlined />,
      label: 'הרשאות מסכים'
    });
    
    menuItems.push({
      key: '/function-permissions',
      icon: <SettingOutlined />,
      label: 'הרשאות פונקציות'
    });
  }

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user.full_name || user.username}`,
      disabled: true
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'התנתק',
      onClick: handleLogout
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        width={250}
        style={{ background: '#fff' }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            {collapsed ? 'ד' : 'Digitlex'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['screens']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      
      <Layout>
        <Header style={{ 
          background: '#001529', 
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            פאנל ניהול Digitlex
          </Title>
          <Space>
            <span style={{ color: 'white' }}>
              {new Date().toLocaleDateString('he-IL')} | {new Date().toLocaleTimeString('he-IL')}
            </span>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Button
                type="text"
                style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Avatar icon={<UserOutlined />} size="small" />
                {user.full_name || user.username}
              </Button>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{ 
          margin: '24px 16px',
          padding: 24,
          background: '#fff',
          borderRadius: 6,
          minHeight: 280
        }}>
          <Routes>
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route 
              path="/" 
              element={
                <ScreensList 
                  screens={screens} 
                  loading={loading} 
                  onRefresh={loadScreens}
                  user={user}
                  socket={socket}
                />
              } 
            />
            <Route 
              path="/create" 
              element={
                <CreateScreen 
                  onScreenCreated={loadScreens}
                  user={user}
                  socket={socket}
                />
              } 
            />
            <Route 
              path="/screen/:id" 
              element={
                <ScreenDetail 
                  onScreenUpdated={loadScreens}
                  socket={socket}
                />
              } 
            />
            <Route 
              path="/users" 
              element={
                (user.role === 'admin' || user.role === 'super_admin') ? (
                  <UserManagement socket={socket} />
                ) : (
                  <div>אין לך הרשאה לגשת לעמוד זה</div>
                )
              } 
            />
            <Route 
              path="/permissions" 
              element={
                (user.role === 'admin' || user.role === 'super_admin') ? (
                  <PermissionsManager socket={socket} />
                ) : (
                  <div>אין לך הרשאה לגשת לעמוד זה</div>
                )
              } 
            />
            <Route 
              path="/function-permissions" 
              element={
                (user.role === 'admin' || user.role === 'super_admin') ? (
                  <FunctionPermissionsManager socket={socket} />
                ) : (
                  <div>אין לך הרשאה לגשת לעמוד זה</div>
                )
              } 
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App; 