import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

function App() {
  const [screenId, setScreenId] = useState(null);
  const [screenData, setScreenData] = useState(null);
  const [content, setContent] = useState([]);
  const [rssContent, setRssContent] = useState([]);
  const [runningMessages, setRunningMessages] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [currentRssIndex, setCurrentRssIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  const socketRef = useRef(null);
  const contentTimerRef = useRef(null);
  const rssTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const offlineDataRef = useRef({
    content: [],
    rssContent: [],
    runningMessages: [],
    lastSync: null
  });

  // Get screen ID from URL parameters or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    const idFromStorage = localStorage.getItem('screenId');
    
    if (idFromUrl) {
      setScreenId(idFromUrl);
      localStorage.setItem('screenId', idFromUrl);
    } else if (idFromStorage) {
      setScreenId(idFromStorage);
    } else {
      setError({
        title: 'מזהה מסך חסר',
        message: 'לא נמצא מזהה מסך. אנא וודא שהכתובת כוללת את פרמטר ?id=SCREEN_ID',
        details: 'דוגמה: http://localhost:3001/client?id=your-screen-id'
      });
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!screenId) return;

    const initSocket = () => {
      socketRef.current = io(window.location.origin, {
        transports: ['websocket', 'polling']
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to server');
        setConnectionStatus('online');
        socketRef.current.emit('join_screen', screenId);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnectionStatus('offline');
      });

      socketRef.current.on('content_updated', () => {
        console.log('Content updated, refreshing...');
        loadContent();
      });

      socketRef.current.on('messages_updated', () => {
        console.log('Messages updated, refreshing...');
        loadRunningMessages();
      });

      socketRef.current.on('time_update', (timeData) => {
        setCurrentTime(new Date(timeData.datetime));
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [screenId]);

  // Load screen data
  const loadScreenData = async () => {
    if (!screenId) return;
    
    try {
      const response = await axios.get(`/api/screens/${screenId}`);
      setScreenData(response.data);
      setConnectionStatus('online');
    } catch (error) {
      console.error('Error loading screen data:', error);
      setConnectionStatus('offline');
      // Use offline data if available
      if (offlineDataRef.current.lastSync) {
        setScreenData({ 
          id: screenId, 
          name: 'Digitlex (מצב לא מקוון)',
          location: 'לא מחובר לשרת'
        });
      } else {
        setError({
          title: 'שגיאה בחיבור',
          message: 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור לאינטרנט.',
          details: error.message
        });
      }
    }
  };

  // Load content
  const loadContent = async () => {
    if (!screenId) return;
    
    try {
      const response = await axios.get(`/api/screens/${screenId}/content`);
      setContent(response.data);
      setCurrentContentIndex(0);
      
      // Save to offline storage
      offlineDataRef.current.content = response.data;
      offlineDataRef.current.lastSync = new Date();
      localStorage.setItem('offlineData', JSON.stringify(offlineDataRef.current));
      
      setConnectionStatus('online');
    } catch (error) {
      console.error('Error loading content:', error);
      setConnectionStatus('offline');
      // Load from offline storage
      const offlineData = localStorage.getItem('offlineData');
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        setContent(parsed.content || []);
        offlineDataRef.current = parsed;
      }
    }
  };

  // Load RSS content
  const loadRSSContent = async () => {
    if (!screenId) return;
    
    try {
      const response = await axios.get(`/api/screens/${screenId}/rss-content`);
      setRssContent(response.data);
      setCurrentRssIndex(0);
      
      // Save to offline storage
      offlineDataRef.current.rssContent = response.data;
      localStorage.setItem('offlineData', JSON.stringify(offlineDataRef.current));
      
    } catch (error) {
      console.error('Error loading RSS content:', error);
      // Load from offline storage
      const offlineData = localStorage.getItem('offlineData');
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        setRssContent(parsed.rssContent || []);
      }
    }
  };

  // Load running messages
  const loadRunningMessages = async () => {
    if (!screenId) return;
    
    try {
      const response = await axios.get(`/api/screens/${screenId}/messages`);
      setRunningMessages(response.data);
      
      // Save to offline storage
      offlineDataRef.current.runningMessages = response.data;
      localStorage.setItem('offlineData', JSON.stringify(offlineDataRef.current));
      
    } catch (error) {
      console.error('Error loading running messages:', error);
      // Load from offline storage
      const offlineData = localStorage.getItem('offlineData');
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        setRunningMessages(parsed.runningMessages || []);
      }
    }
  };

  // Initialize data loading
  useEffect(() => {
    if (!screenId) return;

    const loadAllData = async () => {
      setLoading(true);
      
      // Try to load offline data first
      const offlineData = localStorage.getItem('offlineData');
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        setContent(parsed.content || []);
        setRssContent(parsed.rssContent || []);
        setRunningMessages(parsed.runningMessages || []);
        offlineDataRef.current = parsed;
      }

      await Promise.all([
        loadScreenData(),
        loadContent(),
        loadRSSContent(),
        loadRunningMessages()
      ]);
      
      setLoading(false);
    };

    loadAllData();
  }, [screenId]);

  // Content rotation timer
  useEffect(() => {
    if (content.length === 0) return;

    const startContentRotation = () => {
      if (contentTimerRef.current) {
        clearInterval(contentTimerRef.current);
      }

      contentTimerRef.current = setInterval(() => {
        setCurrentContentIndex(prevIndex => 
          prevIndex >= content.length - 1 ? 0 : prevIndex + 1
        );
      }, content[currentContentIndex]?.display_duration || 5000);
    };

    startContentRotation();

    return () => {
      if (contentTimerRef.current) {
        clearInterval(contentTimerRef.current);
      }
    };
  }, [content, currentContentIndex]);

  // RSS rotation timer
  useEffect(() => {
    if (rssContent.length === 0) return;

    if (rssTimerRef.current) {
      clearInterval(rssTimerRef.current);
    }

    rssTimerRef.current = setInterval(() => {
      setCurrentRssIndex(prevIndex => 
        prevIndex >= rssContent.length - 1 ? 0 : prevIndex + 1
      );
    }, 8000);

    return () => {
      if (rssTimerRef.current) {
        clearInterval(rssTimerRef.current);
      }
    };
  }, [rssContent]);

  // Time update timer
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Periodic sync timer (every hour)
  useEffect(() => {
    if (!screenId) return;

    syncTimerRef.current = setInterval(() => {
      console.log('Syncing data...');
      loadContent();
      loadRSSContent();
      loadRunningMessages();
    }, 60 * 60 * 1000); // Every hour

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [screenId]);

  // Render content item
  const renderContentItem = (item, isActive) => {
    const baseClass = `content-item ${isActive ? 'active' : ''}`;
    
    switch (item.type) {
      case 'image':
      case 'ad':
        return (
          <div key={item.id} className={baseClass}>
            <img 
              src={item.file_path} 
              alt={item.title || 'Content'} 
              className="content-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        );
      
      case 'video':
        return (
          <div key={item.id} className={baseClass}>
            <video 
              src={item.file_path} 
              className="content-video"
              autoPlay 
              muted 
              loop
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        );
      
      case 'code':
        return (
          <div key={item.id} className={baseClass}>
            <div className="content-code">
              <iframe
                srcDoc={item.content}
                title={item.title || 'Custom Content'}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">Digitlex</div>
        <div className="loading-details">
          טוען תוכן...<br />
          {screenId && `מזהה מסך: ${screenId}`}
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠</div>
        <div className="error-title">{error.title}</div>
        <div className="error-message">{error.message}</div>
        {error.details && (
          <div className="error-details">{error.details}</div>
        )}
      </div>
    );
  }

  return (
    <div className="screen-container">
      {/* Status Indicator */}
      <div className={`status-indicator status-${connectionStatus}`}></div>
      
      {/* Header */}
      <header className="screen-header">
        <div className="screen-logo">
          {screenData?.name || 'Digitlex'}
        </div>
        <div className="screen-datetime">
          <div className="screen-time">
            {currentTime.toLocaleTimeString('he-IL', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
          <div className="screen-date">
            {currentTime.toLocaleDateString('he-IL', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="screen-content">
        <div className="content-display">
          {content.length > 0 ? (
            content.map((item, index) => 
              renderContentItem(item, index === currentContentIndex)
            )
          ) : (
            <div className="content-item active">
              <div style={{ 
                textAlign: 'center', 
                fontSize: '48px', 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                ברוכים הבאים
              </div>
            </div>
          )}
        </div>

        {/* RSS Feed */}
        {rssContent.length > 0 && (
          <section className="rss-feed">
            <div className="rss-title">חדשות ועדכונים</div>
            <div className="rss-items">
              {rssContent.map((item, index) => (
                <div 
                  key={index} 
                  className={`rss-item ${index === currentRssIndex ? 'visible' : ''}`}
                  style={{ 
                    top: index === currentRssIndex ? '0' : '100px',
                    zIndex: index === currentRssIndex ? 1 : 0
                  }}
                >
                  <div className="rss-item-title">{item.title}</div>
                  <div className="rss-item-source">{item.source}</div>
                  <div className="rss-item-description">{item.description}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Running Messages */}
      {runningMessages.length > 0 && (
        <footer className="running-messages">
          {runningMessages.map((message, index) => (
            <div 
              key={message.id} 
              className="running-message"
              style={{ 
                animationDuration: `${30 / (message.speed / 50)}s`,
                animationDelay: `${index * 5}s`
              }}
            >
              {message.message}
            </div>
          ))}
        </footer>
      )}
    </div>
  );
}

export default App; 