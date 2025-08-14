import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Card, 
  Tabs, 
  Spin, 
  Button, 
  Space, 
  Tag, 
  message,
  Row,
  Col,
  Alert,
  Modal,
  Input
} from 'antd';
import { 
  ArrowRightOutlined, 
  DesktopOutlined, 
  ReloadOutlined,
  EyeOutlined,
  EditOutlined
} from '@ant-design/icons';
import axios from 'axios';
import ContentManager from './ContentManager';
import RSSManager from './RSSManager';
import MessagesManager from './MessagesManager';

const { Title, Text } = Typography;

const ScreenDetail = ({ onScreenUpdated, socket }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force update every 5 seconds to ensure time display is current
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Force update - עדכון זמן');
      setForceUpdate(prev => prev + 1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadScreen = useCallback(async () => {
    console.log('🔄 טוען מסך:', id);
    try {
      setLoading(true);
      const response = await axios.get(`/api/screens/${id}`);
      console.log('✅ קיבלתי נתוני מסך:', response.data);
      setScreen(response.data);
    } catch (error) {
      console.error('❌ שגיאה בטעינת מסך:', error);
      message.error('שגיאה בטעינת פרטי המסך');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const handleUpdateName = async () => {
    if (!screenName.trim()) return;
    
    try {
      setNameLoading(true);
      await axios.put(`/api/screens/${id}/name`, { name: screenName.trim() });
      message.success(`שם המסך עודכן בהצלחה ל"${screenName.trim()}"!`);
      setNameModalVisible(false);
      setScreenName('');
      await loadScreen(); // Reload screen data
      if (onScreenUpdated) {
        await onScreenUpdated();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      message.error(`שגיאה בעדכון שם המסך: ${errorMessage}`);
    } finally {
      setNameLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadScreen();
    }
  }, [id, loadScreen]);

  useEffect(() => {
    if (!socket) {
      console.log('❌ Socket לא זמין');
      return;
    }
    
    console.log('🔧 רושם Socket.IO events למסך:', id);
    
    // עדכון סטטוס מסך
    socket.on('screen_status_updated', ({ id: screenId, last_seen }) => {
      console.log('📡 קיבלתי עדכון סטטוס:', { screenId, last_seen, currentId: id });
      if (screenId === id) {
        console.log('✅ עדכון סטטוס למסך הנוכחי, טוען מחדש...');
        loadScreen();
      }
    });
    // עדכון שם מסך
    socket.on('screen_name_updated', ({ id: screenId, name }) => {
      console.log('📡 קיבלתי עדכון שם:', { screenId, name, currentId: id });
      if (screenId === id) {
        console.log('✅ עדכון שם למסך הנוכחי, טוען מחדש...');
        loadScreen();
      }
    });
    // עדכון לוגו
    socket.on('screen_logo_updated', ({ id: screenId, logo_url }) => {
      console.log('📡 קיבלתי עדכון לוגו:', { screenId, logo_url, currentId: id });
      if (screenId === id) {
        console.log('✅ עדכון לוגו למסך הנוכחי, טוען מחדש...');
        loadScreen();
      }
    });
    // מחיקת מסך
    socket.on('screen_deleted', ({ id: screenId }) => {
      console.log('📡 קיבלתי מחיקת מסך:', { screenId, currentId: id });
      if (screenId === id) {
        console.log('✅ מחיקת המסך הנוכחי, מעביר לדף הבית...');
        navigate('/');
      }
    });
    // עדכון תוכן
    socket.on('content_updated', () => {
      console.log('📡 קיבלתי עדכון תוכן');
      if (id) {
        console.log('✅ עדכון תוכן למסך הנוכחי, טוען מחדש...');
        loadScreen();
      }
    });
    
    return () => {
      console.log('🧹 מנקה Socket.IO events למסך:', id);
      socket.off('screen_status_updated');
      socket.off('screen_name_updated');
      socket.off('screen_logo_updated');
      socket.off('screen_deleted');
      socket.off('content_updated');
    };
  }, [socket, id, navigate, loadScreen]);

  const getScreenStatus = (lastSeen) => {
    console.log('🔍 בדיקת סטטוס מסך:', { lastSeen, screenId: id });
    if (!lastSeen) return { status: 'offline', text: 'לא מחובר', color: 'red' };
    
    // Parse the timestamp correctly - handle both ISO and local formats
    let lastSeenTime;
    if (lastSeen.includes('T') || lastSeen.includes('Z')) {
      // ISO format
      lastSeenTime = new Date(lastSeen);
    } else {
      // Local format (SQLite CURRENT_TIMESTAMP) - convert to local timezone
      const [datePart, timePart] = lastSeen.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      lastSeenTime = new Date(year, month - 1, day, hour, minute, second);
    }
    
    const now = new Date();
    const diffSeconds = (now - lastSeenTime) / 1000;
    
    console.log('⏰ חישוב זמן:', { 
      lastSeen: lastSeen,
      lastSeenTime: lastSeenTime.toISOString(), 
      now: now.toISOString(), 
      diffSeconds 
    });
    
    if (diffSeconds < 30) {
      return { status: 'online', text: 'מחובר', color: 'green' };
    } else if (diffSeconds < 120) {
      return { status: 'warning', text: 'חיבור לא יציב', color: 'orange' };
    } else {
      return { status: 'offline', text: 'לא מחובר', color: 'red' };
    }
  };

  const openScreenPreview = () => {
    const previewUrl = `${window.location.origin}/client?id=${id}`;
    window.open(previewUrl, '_blank');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>טוען פרטי המסך...</Text>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text>מסך לא נמצא</Text>
      </div>
    );
  }
  
  const status = getScreenStatus(screen.last_seen);

  // Force re-render when forceUpdate changes
  const statusWithUpdate = getScreenStatus(screen.last_seen);

  const tabItems = [
    {
      key: 'content',
      label: 'תוכן ומדיה',
      children: <ContentManager screenId={id} />
    },
    {
      key: 'rss',
      label: 'חדשות RSS',
      children: <RSSManager screenId={id} />
    },
    {
      key: 'messages',
      label: 'הודעות רצות',
      children: <MessagesManager screenId={id} />
    }
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24 
      }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <DesktopOutlined style={{ marginLeft: 8 }} />
            {screen.name}
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              size="small"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setScreenName(screen.name);
                setNameModalVisible(true);
              }}
            />
          </Title>
          <Space style={{ marginTop: 8 }}>
            <Tag color={statusWithUpdate.color}>{statusWithUpdate.text}</Tag>
            <Text type="secondary">מזהה: {screen.id}</Text>
          </Space>
        </div>
        <Space>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#52c41a',
              animation: 'pulse 2s infinite'
            }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>מתעדכן אוטומטית כל דקה</Text>
          </div>
          <Button 
            icon={<EyeOutlined />}
            onClick={openScreenPreview}
          >
            תצוגה מקדימה
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadScreen}
          >
            רענן
          </Button>
          <Button 
            onClick={() => navigate('/')}
            icon={<ArrowRightOutlined />}
          >
            חזור לרשימה
          </Button>
        </Space>
      </div>

      {/* Screen Info */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card size="small">
            <Row gutter={16}>
              <Col span={6}>
                <div>
                  <Text type="secondary">שם המסך:</Text>
                  <div><Text strong>{screen.name}</Text></div>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text type="secondary">מיקום:</Text>
                  <div><Text>{screen.location || 'לא צוין'}</Text></div>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text type="secondary">סטטוס:</Text>
                  <div><Tag color={status.color}>{status.text}</Tag></div>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text type="secondary">סטטוס חיבור:</Text>
                  <div>
                    <Text>
                      {screen.last_seen 
                        ? (() => {
                            const lastSeenTime = new Date(screen.last_seen);
                            const now = new Date();
                            const diffSeconds = Math.floor((now - lastSeenTime) / 1000);
                            const isOnline = diffSeconds < 30;
                            
                            if (isOnline) {
                              return 'מחובר';
                            } else if (diffSeconds < 60) {
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
                          })()
                        : 'אף פעם'
                      }
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Instructions Alert */}
      {status.status === 'offline' && (
        <Alert
          message="המסך לא מחובר"
          description={
            <div>
              <p>כדי לחבר את המסך:</p>
              <ol style={{ marginRight: 20 }}>
                <li>הורד והתקן את תוכנת Digitlex במחשב</li>
                <li>הזן את מזהה המסך: <Text code copyable>{screen.id}</Text></li>
                <li>וודא שהמחשב מחובר לאינטרנט</li>
              </ol>
            </div>
          }
          type="warning"
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Content Management Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      {/* Name Update Modal */}
      <Modal
        title="עדכון שם מסך"
        open={nameModalVisible}
        onOk={handleUpdateName}
        onCancel={() => {
          setNameModalVisible(false);
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

export default ScreenDetail; 