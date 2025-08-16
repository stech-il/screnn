import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Button, Spin, Empty, Tag, Space, Popconfirm, message, Modal, Input, List, Grid } from 'antd';
import { PlusOutlined, DesktopOutlined, EyeOutlined, ReloadOutlined, DeleteOutlined, PictureOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

const { Title, Text } = Typography;

const ScreensList = ({ screens, loading, onRefresh, user, socket }) => {
  const navigate = useNavigate();
  const screensBreakpoint = Grid.useBreakpoint();
  const isMobile = !screensBreakpoint.md; // עד 768px נחשב מובייל
  const [logoModalVisible, setLogoModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [screenName, setScreenName] = useState('');
  const [logoLoading, setLogoLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;
    // עדכון מסך שנמחק
    socket.on('screen_deleted', ({ id }) => {
      onRefresh();
    });
    // עדכון לוגו
    socket.on('screen_logo_updated', ({ id, logo_url }) => {
      onRefresh();
    });
    // עדכון שם מסך
    socket.on('screen_name_updated', ({ id, name }) => {
      onRefresh();
    });
    // עדכון סטטוס מסך - אופטימיזציה למניעת ריענון מיותר
    socket.on('screen_status_updated', ({ id, last_seen }) => {
      console.log('📡 ScreensList: screen_status_updated received for', id);
      // במקום לרענן הכל, נעדכן רק אם באמת צריך
      // הרענון יקרה כבר ב-App.js דרך ה-setScreens
      // אז אנחנו לא צריכים onRefresh() נוסף כאן
    });
    // עדכון תוכן
    socket.on('content_updated', () => {
      onRefresh();
    });
    return () => {
      socket.off('screen_deleted');
      socket.off('screen_logo_updated');
      socket.off('screen_name_updated');
      socket.off('screen_status_updated');
      socket.off('content_updated');
    };
  }, [socket, onRefresh]);

  const handleDeleteScreen = async (screenId, screenName) => {
    try {
      await api.delete(`/api/screens/${screenId}`);
      message.success(`מסך "${screenName}" נמחק בהצלחה!`);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      message.error(`שגיאה במחיקת המסך: ${errorMessage}`);
    }
  };

  const handleUpdateLogo = async () => {
    if (!selectedScreen) return;
    
    try {
      setLogoLoading(true);
      await api.put(`/api/screens/${selectedScreen.id}/logo`, { logo_url: logoUrl });
      message.success(`לוגו עודכן בהצלחה למסך "${selectedScreen.name}"!`);
      setLogoModalVisible(false);
      setSelectedScreen(null);
      setLogoUrl('');
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      message.error(`שגיאה בעדכון הלוגו: ${errorMessage}`);
    } finally {
      setLogoLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!selectedScreen || !screenName.trim()) return;
    
    try {
      setNameLoading(true);
      await api.put(`/api/screens/${selectedScreen.id}/name`, { name: screenName.trim() });
      message.success(`שם המסך עודכן בהצלחה ל"${screenName.trim()}"!`);
      setNameModalVisible(false);
      setSelectedScreen(null);
      setScreenName('');
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      message.error(`שגיאה בעדכון שם המסך: ${errorMessage}`);
    } finally {
      setNameLoading(false);
    }
  };

  const openLogoModal = (screen) => {
    setSelectedScreen(screen);
    setLogoUrl(screen.logo_url || '');
    setLogoModalVisible(true);
  };

  const openNameModal = (screen) => {
    setSelectedScreen(screen);
    setScreenName(screen.name || '');
    setNameModalVisible(true);
  };

  const getScreenStatus = (lastSeen) => {
    if (!lastSeen) return { status: 'offline', text: 'לא מחובר', color: 'red' };
    
    const lastSeenTime = new Date(lastSeen);
    const now = new Date();
    const diffSeconds = (now - lastSeenTime) / 1000;
    
    if (diffSeconds < 30) {
      return { status: 'online', text: 'מחובר', color: 'green' };
    } else if (diffSeconds < 120) {
      return { status: 'warning', text: 'חיבור לא יציב', color: 'orange' };
    } else {
      return { status: 'offline', text: 'לא מחובר', color: 'red' };
    }
  };

  const formatLastSeen = (lastSeen, isOnline) => {
    if (!lastSeen) return 'אף פעם';
    
    // If online, just show "מחובר"
    if (isOnline) {
      return 'מחובר';
    }
    
    // If offline, show when last connected
    const lastSeenTime = new Date(lastSeen);
    const now = new Date();
    const diffSeconds = Math.floor((now - lastSeenTime) / 1000);
    
    if (diffSeconds < 60) {
      return `התנתק לפני ${diffSeconds} שניות`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `התנתק לפני ${minutes} דקות`;
    } else if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `התנתק לפני ${hours} שעות`;
    } else {
      return `התחבר לאחרונה: ${lastSeenTime.toLocaleDateString('he-IL')} ${lastSeenTime.toLocaleTimeString('he-IL')}`;
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>טוען מסכים...</Text>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: isMobile ? 16 : 24 
      }}>
        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
          <DesktopOutlined style={{ marginLeft: 8 }} />
          רשימת מסכים
        </Title>
        <Space wrap>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#52c41a', animation: 'pulse 2s infinite' }} />
            {!isMobile && (<Text type="secondary" style={{ fontSize: 12 }}>מתעדכן אוטומטית בשקט</Text>)}
          </div>
          <Button size={isMobile ? 'small' : 'middle'} icon={<ReloadOutlined />} onClick={onRefresh}>רענן</Button>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Button size={isMobile ? 'small' : 'middle'} type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
              {isMobile ? 'מסך חדש' : 'הוסף מסך חדש'}
            </Button>
          )}
        </Space>
      </div>

      {screens.length === 0 ? (
        <Empty
          description="אין מסכים במערכת"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {(user?.role === 'admin' || user?.role === 'super_admin') ? (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/create')}
            >
              צור מסך ראשון
            </Button>
          ) : (
            <Text type="secondary">צור קשר עם מנהל המערכת ליצירת מסכים</Text>
          )}
        </Empty>
      ) : (
        isMobile ? (
          <List
            itemLayout="vertical"
            dataSource={screens}
            renderItem={(screen) => {
              const status = getScreenStatus(screen.last_seen);
              return (
                <List.Item key={screen.id} style={{ background: '#fff', borderRadius: 8, padding: 12 }} onClick={() => navigate(`/screen/${screen.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1890ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DesktopOutlined />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{screen.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>מזהה: {screen.id.slice(0,8)} • {formatLastSeen(screen.last_seen, status.status === 'online')}</div>
                      </div>
                    </div>
                    <div>
                      <Tag color={status.color}>{status.text}</Tag>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/screen/${screen.id}`); }}>פרטים</Button>
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <>
                        <Button size="small" onClick={(e) => { e.stopPropagation(); openNameModal(screen); }}>שם</Button>
                        <Button size="small" onClick={(e) => { e.stopPropagation(); openLogoModal(screen); }}>לוגו</Button>
                        <Popconfirm
                          title={`למחוק את "${screen.name}"?`}
                          onConfirm={() => handleDeleteScreen(screen.id, screen.name)}
                          okText="מחק" cancelText="ביטול" okType="danger"
                        >
                          <Button size="small" danger onClick={(e) => e.stopPropagation()}>מחק</Button>
                        </Popconfirm>
                      </>
                    )}
                  </div>
                </List.Item>
              );
            }}
          />
        ) : (
          <Row gutter={[12, 12]}>
            {screens.map(screen => {
              const status = getScreenStatus(screen.last_seen);
              return (
                <Col xs={24} sm={12} lg={8} xl={6} key={screen.id}>
                  <Card
                    className="screen-card"
                    hoverable
                    onClick={() => navigate(`/screen/${screen.id}`)}
                    actions={[
                      <EyeOutlined key="view" onClick={(e) => { e.stopPropagation(); navigate(`/screen/${screen.id}`); }} />,
                      (user?.role === 'admin' || user?.role === 'super_admin') && (
                        <EditOutlined key="edit" style={{ color: '#52c41a' }} onClick={(e) => { e.stopPropagation(); openNameModal(screen); }} />
                      ),
                      (user?.role === 'admin' || user?.role === 'super_admin') && (
                        <PictureOutlined key="logo" style={{ color: '#1890ff' }} onClick={(e) => { e.stopPropagation(); openLogoModal(screen); }} />
                      ),
                      (user?.role === 'admin' || user?.role === 'super_admin') && (
                        <Popconfirm key="delete" title={`האם אתה בטוח שברצונך למחוק את המסך "${screen.name}"?`} onConfirm={() => handleDeleteScreen(screen.id, screen.name)} okText="כן, מחק" cancelText="ביטול" okType="danger">
                          <DeleteOutlined style={{ color: '#ff4d4f' }} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      )
                    ].filter(Boolean)}
                  >
                    <Card.Meta
                      avatar={<div style={{ width: 40, height: 40, background: '#1890ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}><DesktopOutlined /></div>}
                      title={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>{screen.name}</span><div style={{ display: 'flex', gap: 4 }}>{screen.permission_type && (<Tag color={getPermissionColor(screen.permission_type)}>{getPermissionText(screen.permission_type)}</Tag>)}<Tag color={status.color}>{status.text}</Tag></div></div>}
                      description={<div><div style={{ marginBottom: 8 }}><Text type="secondary">מיקום: </Text><Text>{screen.location || 'לא צוין'}</Text></div><div style={{ marginBottom: 8 }}><Text type="secondary">מזהה: </Text><Text code copyable>{screen.id}</Text></div><div><Text type="secondary">סטטוס: </Text><Text>{formatLastSeen(screen.last_seen, status.status === 'online')}</Text></div></div>}
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
        )
      )}

      {/* Logo Update Modal */}
      <Modal
        title={`עדכון לוגו - ${selectedScreen?.name || ''}`}
        open={logoModalVisible}
        onOk={handleUpdateLogo}
        onCancel={() => {
          setLogoModalVisible(false);
          setSelectedScreen(null);
          setLogoUrl('');
        }}
        confirmLoading={logoLoading}
        okText="עדכן לוגו"
        cancelText="ביטול"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            הזן כתובת URL של תמונה שתוצג כלוגו במסך זה
          </Text>
        </div>
        <Input
          placeholder="https://example.com/logo.png"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          onPressEnter={handleUpdateLogo}
        />
        {logoUrl && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <img 
              src={logoUrl} 
              alt="תצוגה מקדימה" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: 100, 
                objectFit: 'contain',
                border: '1px solid #d9d9d9',
                borderRadius: 4
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                message.warning('לא ניתן לטעון את התמונה. בדוק את הכתובת.');
              }}
            />
          </div>
        )}
      </Modal>

      {/* Name Update Modal */}
      <Modal
        title={`עדכון שם מסך - ${selectedScreen?.name || ''}`}
        open={nameModalVisible}
        onOk={handleUpdateName}
        onCancel={() => {
          setNameModalVisible(false);
          setSelectedScreen(null);
          setScreenName('');
        }}
        confirmLoading={nameLoading}
        okText="עדכן שם"
        cancelText="ביטול"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            הזן שם חדש למסך זה
          </Text>
        </div>
        <Input
          placeholder="לדוגמה: מסך כניסה ראשית"
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          onPressEnter={handleUpdateName}
          maxLength={50}
          showCount
        />
      </Modal>
    </div>
  );
};

export default ScreensList; 