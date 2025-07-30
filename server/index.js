const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const RSSParser = require('rss-parser');
const cron = require('node-cron');
const { Server } = require('socket.io');
const http = require('http');
const bcrypt = require('bcrypt');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Add detailed logging
const logError = (error, context = '') => {
  console.error(`❌ שגיאה ${context}:`, error);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
};

const logInfo = (message) => {
  console.log(`ℹ️ ${message}`);
};

const logSuccess = (message) => {
  console.log(`✅ ${message}`);
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Add Socket.IO connection logging
io.on('connection', (socket) => {
  console.log('🔌 === SOCKET.IO CONNECTION ===');
  console.log('📅 זמן:', new Date().toISOString());
  console.log('🆔 Socket ID:', socket.id);
  console.log('🌐 IP:', socket.handshake.address);
  console.log('📊 Headers:', socket.handshake.headers);
  logSuccess(`Socket.IO מחובר: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log('❌ === SOCKET.IO DISCONNECTION ===');
    console.log('📅 זמן:', new Date().toISOString());
    console.log('🆔 Socket ID:', socket.id);
    console.log('📋 סיבה:', reason);
    logInfo(`Socket.IO מנותק: ${socket.id} - ${reason}`);
  });
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Set-Cookie']
}));
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 === REQUEST RECEIVED ===`);
  console.log(`📅 זמן: ${timestamp}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`📋 Method: ${req.method}`);
  console.log(`🔗 URL: ${req.url}`);
  console.log(`📄 Path: ${req.path}`);
  console.log(`📊 Headers:`, req.headers);
  console.log(`📋 Body:`, req.body);
  logInfo(`${req.method} ${req.path} - ${req.ip}`);
  
  // Special logging for heartbeat requests
  if (req.path.includes('/heartbeat')) {
    console.log(`💓 === HEARTBEAT REQUEST DETECTED ===`);
    console.log(`📋 Method: ${req.method}`);
    console.log(`🔗 Path: ${req.path}`);
    console.log(`📊 Expected: POST, Actual: ${req.method}`);
  }
  
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // הגדרת headers נוספים לקבצי מדיה
    if (path.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico|mp4|avi|mov|wmv|webm)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));
app.use('/admin', express.static(path.join(__dirname, '../admin-panel/build')));
app.use('/client', express.static(path.join(__dirname, '../client-app/build')));

// Session configuration
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './',
    table: 'sessions'
  }),
  secret: 'your-secret-key-change-this-in-production',
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'sid'
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  logInfo(`🔐 בדיקת אימות - Session: ${JSON.stringify(req.session)}`);
  if (req.session && req.session.userId) {
    logSuccess(`משתמש מחובר: ${req.session.userId}`);
    next();
  } else {
    logError('משתמש לא מחובר', 'auth');
    res.status(401).json({ error: 'לא מחובר' });
  }
};

// Permission middleware
const requirePermission = (permissionType) => {
  return async (req, res, next) => {
    try {
      const { screenId } = req.params;
      logInfo(`🔒 בדיקת הרשאה - סוג: ${permissionType}, משתמש: ${req.session.userId}`);
      
      // Get user permissions for this screen
      const permission = await new Promise((resolve, reject) => {
        db.get(
          'SELECT permission_type FROM screen_permissions WHERE user_id = ? AND screen_id = ?',
          [req.session.userId, screenId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!permission) {
        return res.status(403).json({ error: 'אין לך הרשאה למסך זה' });
      }

      // Check permission hierarchy
      const permissionLevels = { 'read': 1, 'write': 2, 'admin': 3 };
      const requiredLevel = permissionLevels[permissionType] || 1;
      const userLevel = permissionLevels[permission.permission_type] || 0;

      if (userLevel >= requiredLevel) {
        next();
      } else {
        res.status(403).json({ error: 'אין לך הרשאה מספקת למסך זה' });
      }
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
  };
};

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'screens.db'));

// אופטימיזציות לביצועים
db.configure('busyTimeout', 30000);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA cache_size = 10000');
db.exec('PRAGMA temp_store = memory');
db.exec('PRAGMA mmap_size = 268435456'); // 256MB

// Initialize database tables
db.serialize(() => {
  // Screens table
  db.run(`CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active',
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Content table
  db.run(`CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    screen_id TEXT,
    type TEXT NOT NULL, -- 'image', 'video', 'ad', 'rss', 'message', 'code'
    title TEXT,
    content TEXT,
    file_path TEXT,
    display_duration INTEGER DEFAULT 5000,
    is_active INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (screen_id) REFERENCES screens (id)
  )`);

  // RSS sources table
  db.run(`CREATE TABLE IF NOT EXISTS rss_sources (
    id TEXT PRIMARY KEY,
    screen_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    refresh_interval INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (screen_id) REFERENCES screens (id)
  )`);

  // Running messages table
  db.run(`CREATE TABLE IF NOT EXISTS running_messages (
    id TEXT PRIMARY KEY,
    screen_id TEXT,
    content TEXT NOT NULL,
    speed INTEGER DEFAULT 50,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (screen_id) REFERENCES screens (id)
  )`);

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Screen permissions table
  db.run(`CREATE TABLE IF NOT EXISTS screen_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    screen_id TEXT,
    permission_type TEXT DEFAULT 'read',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (screen_id) REFERENCES screens (id)
  )`);

  // User sessions table
  db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create default admin user if not exists
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (err) {
      logError(err, 'בדיקת משתמש admin');
      return;
    }
    
    if (!row) {
      bcrypt.hash('admin123', 10).then(hash => {
        db.run(
          'INSERT INTO users (id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), 'admin', hash, 'מנהל מערכת', 'super_admin']
        );
        logSuccess('משתמש admin נוצר בהצלחה');
      });
    }
  });
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// RSS parser
const parser = new RSSParser();

// Health check endpoint for desktop app
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Digital Signage Server'
  });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  logInfo('🔐 בקשת התחברות');
  const { username, password } = req.body;
  logInfo(`משתמש: ${username}`);
  
  if (!username || !password) {
    logError('שם משתמש או סיסמה חסרים', 'login');
    return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
  }
  
  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], async (err, user) => {
    if (err) {
      logError(err, 'בדיקת משתמש בהתחברות');
      return res.status(500).json({ error: 'שגיאה בשרת' });
    }
    
    if (!user) {
      logError(`משתמש לא נמצא: ${username}`, 'login');
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }
    
    try {
      logInfo(`משתמש נמצא, בודק סיסמה...`);
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        logError(`סיסמה שגויה למשתמש: ${username}`, 'login');
        return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
      }
      
      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      logSuccess(`התחברות מוצלחת: ${username} (${user.role})`);
      logInfo(`Session ID: ${req.sessionID}`);
      logInfo(`Session data: ${JSON.stringify(req.session)}`);
      
      // Log session
      const sessionId = uuidv4();
      db.run(
        'INSERT INTO user_sessions (id, user_id, session_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), user.id, sessionId, req.ip, req.get('User-Agent'), new Date(Date.now() + 24 * 60 * 60 * 1000)]
      );
      
      res.json({
        message: 'התחברות מוצלחת',
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      logError(error, 'התחברות - שגיאה כללית');
      res.status(500).json({ error: 'שגיאה בשרת' });
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  logInfo('🚪 בקשת התנתקות');
  logInfo(`משתמש מתנתק: ${req.session?.username || 'לא ידוע'}`);
  
  req.session.destroy((err) => {
    if (err) {
      logError(err, 'התנתקות');
      return res.status(500).json({ error: 'שגיאה בהתנתקות' });
    }
    logSuccess('התנתקות מוצלחת');
    res.json({ message: 'התנתקות מוצלחת' });
  });
});

app.get('/api/auth/me', (req, res) => {
  logInfo('👤 בקשת פרטי משתמש נוכחי');
  logInfo(`Session: ${JSON.stringify(req.session)}`);
  
  if (!req.session.userId) {
    logError('משתמש לא מחובר', 'auth/me');
    return res.status(401).json({ error: 'לא מחובר' });
  }
  
  logInfo(`מחפש משתמש עם ID: ${req.session.userId}`);
  
  db.get('SELECT id, username, full_name, email, role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת משתמש נוכחי');
      return res.status(500).json({ error: 'שגיאה בשרת' });
    }
    
    if (!user) {
      logError('משתמש לא נמצא', 'auth/me');
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }
    
    logSuccess(`משתמש נמצא: ${user.username} (${user.role})`);
    res.json({ user });
  });
});

// Screen management routes
app.get('/api/user/screens', requireAuth, (req, res) => {
  logInfo('📺 בקשת מסכים למשתמש');
  logInfo(`משתמש: ${req.session.userId}`);
  
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות משתמש');
      return res.status(500).json({ error: 'שגיאה בשרת' });
    }
    
    if (user.role === 'super_admin' || user.role === 'admin') {
      logInfo(`משתמש ${user.role} - טוען כל המסכים`);
      db.all('SELECT * FROM screens ORDER BY created_at DESC', (err, screens) => {
        if (err) {
          logError(err, 'טעינת מסכים למנהל');
          return res.status(500).json({ error: 'שגיאה בשרת' });
        }
        
        // Convert last_seen to ISO format for all screens
        const screensWithISO = screens.map(screen => {
          const screenData = { ...screen };
          if (screenData.last_seen && !screenData.last_seen.includes('T')) {
            // Convert local timestamp to ISO
            const [datePart, timePart] = screenData.last_seen.split(' ');
            const [year, month, day] = datePart.split('-');
            const [hour, minute, second] = timePart.split(':');
            const localDate = new Date(year, month - 1, day, hour, minute, second);
            screenData.last_seen = localDate.toISOString();
          }
          return screenData;
        });
        
        logSuccess(`נטענו ${screensWithISO.length} מסכים למנהל`);
        res.json(screensWithISO);
      });
    } else {
      logInfo(`משתמש רגיל - טוען מסכים מורשים`);
      db.all(
        `SELECT s.* FROM screens s 
         INNER JOIN screen_permissions sp ON s.id = sp.screen_id 
         WHERE sp.user_id = ? 
         ORDER BY s.created_at DESC`,
        [req.session.userId],
        (err, screens) => {
          if (err) {
            logError(err, 'טעינת מסכים למשתמש');
            return res.status(500).json({ error: 'שגיאה בשרת' });
          }
          
          // Convert last_seen to ISO format for all screens
          const screensWithISO = screens.map(screen => {
            const screenData = { ...screen };
            if (screenData.last_seen && !screenData.last_seen.includes('T')) {
              // Convert local timestamp to ISO
              const [datePart, timePart] = screenData.last_seen.split(' ');
              const [year, month, day] = datePart.split('-');
              const [hour, minute, second] = timePart.split(':');
              const localDate = new Date(year, month - 1, day, hour, minute, second);
              screenData.last_seen = localDate.toISOString();
            }
            return screenData;
          });
          
          logSuccess(`נטענו ${screensWithISO.length} מסכים למשתמש`);
          res.json(screensWithISO);
        }
      );
    }
  });
});

app.post('/api/screens', requireAuth, (req, res) => {
  logInfo('➕ בקשת יצירת מסך חדש');
  const { name, location } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO screens (id, name, location) VALUES (?, ?, ?)',
    [id, name, location],
    function(err) {
      if (err) {
        logError(err, 'יצירת מסך חדש');
        return res.status(500).json({ error: 'שגיאה ביצירת מסך' });
      }
      
      logSuccess(`מסך חדש נוצר: ${name} (${id})`);
      
      // Give creator full permissions
      db.run(
        'INSERT INTO screen_permissions (id, user_id, screen_id, permission_type) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.session.userId, id, 'admin']
      );
      
      res.json({ 
        id, 
        name, 
        location,
        message: 'מסך נוצר בהצלחה' 
      });
    }
  );
});

// Update screen name (admin only)
app.put('/api/screens/:id/name', requireAuth, (req, res) => {
  logInfo('✏️ בקשת עדכון שם מסך');
  const { id } = req.params;
  const { name } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון שם מסך');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה לעדכן שם מסך ללא הרשאה`, 'update-screen-name');
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן שם מסך' });
    }
    
    // Check if screen exists
    db.get('SELECT name as old_name FROM screens WHERE id = ?', [id], (err, screen) => {
      if (err) {
        logError(err, 'בדיקת קיום מסך לעדכון שם');
        return res.status(500).json({ error: 'שגיאה בבדיקת מסך' });
      }
      
      if (!screen) {
        logError(`מסך לא נמצא לעדכון שם: ${id}`, 'update-screen-name');
        return res.status(404).json({ error: 'מסך לא נמצא' });
      }
      
      // Update name
      db.run(
        'UPDATE screens SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, id],
        function(err) {
          if (err) {
            logError(err, 'עדכון שם מסך');
            return res.status(500).json({ error: 'שגיאה בעדכון שם' });
          }
          
          logSuccess(`שם מסך עודכן בהצלחה: "${screen.old_name}" -> "${name}" (${id}) על ידי ${req.session.username}`);
          
          // Emit to all connected clients
          io.emit('screen_name_updated', { id, name });
          
          res.json({
            message: 'שם מסך עודכן בהצלחה',
            screen_id: id,
            name: name,
            old_name: screen.old_name
          });
        }
      );
    });
  });
});

app.get('/api/screens/:id', (req, res) => {
  const { id } = req.params;
  logInfo(`📺 בקשת מסך ספציפי: ${id}`);
  
  db.get('SELECT * FROM screens WHERE id = ?', [id], (err, row) => {
    if (err) {
      logError(err, 'בדיקת מסך ספציפי');
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      // Create screen automatically if it doesn't exist
      logInfo(`יצירת מסך חדש אוטומטית: ${id}`);
      db.run(
        'INSERT INTO screens (id, name, location, logo_url) VALUES (?, ?, ?, ?)',
        [id, `מסך ${id.substring(0, 8)}`, 'לא צוין', null],
        function(insertErr) {
          if (insertErr) {
            logError(insertErr, 'יצירת מסך אוטומטית');
            res.status(500).json({ error: insertErr.message });
            return;
          }
          
          // Update last seen for new screen
          db.run('UPDATE screens SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [id]);
          
          // Give permissions to all admins for the new screen
          db.all('SELECT id FROM users WHERE role IN (?, ?)', ['admin', 'super_admin'], (err, admins) => {
            if (err) {
              logError(err, 'בדיקת מנהלים להרשאות אוטומטיות');
            } else {
              admins.forEach(admin => {
                db.run(
                  'INSERT OR IGNORE INTO screen_permissions (id, user_id, screen_id, permission_type) VALUES (?, ?, ?, ?)',
                  [uuidv4(), admin.id, id, 'admin']
                );
              });
              logInfo(`נוצרו הרשאות אוטומטיות למסך ${id} עבור ${admins.length} מנהלים`);
            }
          });
          
          // Return the newly created screen
          const newScreen = {
            id: id,
            name: `מסך ${id.substring(0, 8)}`,
            location: 'לא צוין',
            status: 'active',
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          logSuccess(`מסך חדש נוצר אוטומטית: ${id}`);
          res.json(newScreen);
        }
      );
    } else {
      // Update last seen for existing screen
      db.run('UPDATE screens SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      logInfo(`מסך קיים נמצא: ${row.name} (${id})`);
      
      // Convert last_seen to ISO format if it's in local format
      const screenData = { ...row };
      if (screenData.last_seen && !screenData.last_seen.includes('T')) {
        // Convert local timestamp to ISO
        const [datePart, timePart] = screenData.last_seen.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        const localDate = new Date(year, month - 1, day, hour, minute, second);
        screenData.last_seen = localDate.toISOString();
      }
      
      res.json(screenData);
    }
  });
});

// Screen heartbeat endpoint
app.post('/api/screens/:id/heartbeat', (req, res) => {
  const { id } = req.params;
  const currentTime = new Date().toISOString();
  console.log(`\n💓 === HEARTBEAT RECEIVED ===`);
  console.log(`📅 זמן: ${currentTime}`);
  console.log(`🆔 מזהה מסך: ${id}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`📊 Headers:`, req.headers);
  console.log(`📋 Body:`, req.body);
  logInfo(`💓 heartbeat ממסך: ${id}`);
  
  db.run('UPDATE screens SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [id], function(err) {
    if (err) {
      logError(err, 'heartbeat - עדכון מסך');
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      // Screen doesn't exist, create it
      logInfo(`מסך לא קיים, יוצר חדש: ${id}`);
      db.run(
        'INSERT INTO screens (id, name, location) VALUES (?, ?, ?)',
        [id, `מסך ${id.substring(0, 8)}`, 'לא צוין'],
        function(insertErr) {
          if (insertErr) {
            logError(insertErr, 'heartbeat - יצירת מסך');
            res.status(500).json({ error: insertErr.message });
            return;
          }
          // Update last seen for new screen
          db.run('UPDATE screens SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [id]);
          
          // Give permissions to all admins for the new screen
          db.all('SELECT id FROM users WHERE role IN (?, ?)', ['admin', 'super_admin'], (err, admins) => {
            if (err) {
              logError(err, 'בדיקת מנהלים להרשאות אוטומטיות - heartbeat');
            } else {
              admins.forEach(admin => {
                db.run(
                  'INSERT OR IGNORE INTO screen_permissions (id, user_id, screen_id, permission_type) VALUES (?, ?, ?, ?)',
                  [uuidv4(), admin.id, id, 'admin']
                );
              });
              logInfo(`נוצרו הרשאות אוטומטיות למסך ${id} עבור ${admins.length} מנהלים (heartbeat)`);
            }
          });
          
          logSuccess(`מסך נוצר ועודכן: ${id}`);
          const currentTime = new Date().toISOString();
          logInfo(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
          io.emit('screen_status_updated', { id, last_seen: currentTime });
          res.json({ message: 'מסך נוצר ועודכן', created: true });
        }
      );
    } else {
      logInfo(`סטטוס מסך עודכן: ${id}`);
      const currentTime = new Date().toISOString();
      console.log(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
      logInfo(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
      io.emit('screen_status_updated', { id, last_seen: currentTime });
      console.log(`✅ Heartbeat הושלם - סטטוס עודכן`);
      res.json({ message: 'סטטוס עודכן', created: false });
    }
  });
});

// Content management (protected routes)
app.get('/api/screens/:screenId/content', requirePermission('read'), (req, res) => {
  const { screenId } = req.params;
  
  db.all(
    'SELECT * FROM content WHERE screen_id = ? AND is_active = 1 ORDER BY order_index, created_at',
    [screenId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Public content endpoint for desktop client (no authentication required)
app.get('/api/screens/:screenId/content/public', (req, res) => {
  const { screenId } = req.params;
  
  db.all(
    'SELECT * FROM content WHERE screen_id = ? AND is_active = 1 ORDER BY order_index, created_at',
    [screenId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.post('/api/screens/:screenId/content', requirePermission('write'), upload.single('file'), (req, res) => {
  const { screenId } = req.params;
  const { type, title, content, display_duration = 5000, order_index = 0 } = req.body;
  const id = uuidv4();
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.run(
    `INSERT INTO content (id, screen_id, type, title, content, file_path, display_duration, order_index) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, screenId, type, title, content, file_path, display_duration, order_index],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Notify connected screens
      io.to(screenId).emit('content_updated');
      
      res.json({ id, message: 'תוכן נוסף בהצלחה' });
    }
  );
});

// Update content endpoint
app.put('/api/screens/:screenId/content/:contentId', requirePermission('write'), upload.single('file'), (req, res) => {
  const { screenId, contentId } = req.params;
  const { type, title, content, display_duration, order_index } = req.body;
  
  logInfo(`📝 בקשת עדכון תוכן: ${contentId} במסך ${screenId}`);
  
  // Check if content exists
  db.get('SELECT * FROM content WHERE id = ? AND screen_id = ?', [contentId, screenId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'תוכן לא נמצא' });
      return;
    }
    
    // Update content
    const updateFields = [];
    const updateValues = [];
    
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(content);
    }
    if (display_duration !== undefined) {
      updateFields.push('display_duration = ?');
      updateValues.push(display_duration);
    }
    if (order_index !== undefined) {
      updateFields.push('order_index = ?');
      updateValues.push(order_index);
    }
    
    // Handle file upload if provided
    if (req.file) {
      updateFields.push('file_path = ?');
      updateValues.push(`/uploads/${req.file.filename}`);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(contentId);
    
    const updateQuery = `UPDATE content SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(updateQuery, updateValues, function(updateErr) {
      if (updateErr) {
        res.status(500).json({ error: updateErr.message });
        return;
      }
      
      // Notify connected screens
      io.to(screenId).emit('content_updated');
      
      logSuccess(`תוכן עודכן בהצלחה: ${contentId}`);
      res.json({ message: 'תוכן עודכן בהצלחה' });
    });
  });
});

// RSS management (protected routes)
app.get('/api/screens/:screenId/rss', requirePermission('read'), (req, res) => {
  const { screenId } = req.params;
  
  db.all(
    'SELECT * FROM rss_sources WHERE screen_id = ? AND is_active = 1',
    [screenId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.post('/api/screens/:screenId/rss', requirePermission('write'), (req, res) => {
  const { screenId } = req.params;
  const { name, url, refresh_interval = 60 } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO rss_sources (id, screen_id, name, url, refresh_interval) VALUES (?, ?, ?, ?, ?)',
    [id, screenId, name, url, refresh_interval],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, message: 'מקור RSS נוסף בהצלחה' });
    }
  );
});

// Get RSS content (public endpoint for desktop client)
app.get('/api/screens/:screenId/rss-content', async (req, res) => {
  const { screenId } = req.params;
  
  db.all(
    'SELECT * FROM rss_sources WHERE screen_id = ? AND is_active = 1',
    [screenId],
    async (err, sources) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      try {
        const allItems = [];
        
        for (const source of sources) {
          const feed = await parser.parseURL(source.url);
          const items = feed.items.slice(0, 10).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            link: item.link,
            pubDate: item.pubDate,
            source: source.name
          }));
          allItems.push(...items);
        }
        
        // Sort by date
        allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        res.json(allItems.slice(0, 20));
      } catch (error) {
        res.status(500).json({ error: 'שגיאה בטעינת RSS: ' + error.message });
      }
    }
  );
});

// Running messages (protected routes)
app.get('/api/screens/:screenId/messages', (req, res) => {
  const { screenId } = req.params;
  
  db.all(
    'SELECT id, screen_id, content, speed, is_active, created_at FROM running_messages WHERE screen_id = ? AND is_active = 1',
    [screenId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.post('/api/screens/:screenId/messages', (req, res) => {
  const { screenId } = req.params;
  const { message, content, speed = 50 } = req.body;
  const messageText = content || message; // Support both field names
  const id = uuidv4();
  
  db.run(
    'INSERT INTO running_messages (id, screen_id, content, speed) VALUES (?, ?, ?, ?)',
    [id, screenId, messageText, speed],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Notify connected screens
      io.to(screenId).emit('messages_updated');
      
      res.json({ id, message: 'הודעה רצה נוספה בהצלחה' });
    }
  );
});

// Test RSS endpoint (protected)
app.get('/api/test-rss', requireAuth, async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    res.status(400).json({ error: 'URL parameter is required' });
    return;
  }
  
  try {
    const feed = await parser.parseURL(url);
    res.json({
      title: feed.title,
      description: feed.description,
      items: feed.items.slice(0, 5).map(item => ({
        title: item.title,
        description: item.contentSnippet || item.content,
        pubDate: item.pubDate
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse RSS feed: ' + error.message });
  }
});

// Delete content endpoint (protected)
app.delete('/api/screens/:screenId/content/:contentId', requirePermission('write'), (req, res) => {
  const { contentId } = req.params;
  
  db.run('DELETE FROM content WHERE id = ?', [contentId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Content deleted successfully' });
  });
});

// Update content endpoint (protected)
app.put('/api/screens/:screenId/content/:contentId', requirePermission('write'), upload.single('file'), (req, res) => {
  const { contentId } = req.params;
  const { type, title, content, display_duration, order_index } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : undefined;
  
  let updateQuery = 'UPDATE content SET type = ?, title = ?, content = ?, display_duration = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  let params = [type, title, content, display_duration, order_index, contentId];
  
  if (file_path) {
    updateQuery = 'UPDATE content SET type = ?, title = ?, content = ?, file_path = ?, display_duration = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    params = [type, title, content, file_path, display_duration, order_index, contentId];
  }
  
  db.run(updateQuery, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Content updated successfully' });
  });
});

// Delete RSS source endpoint
app.delete('/api/screens/:screenId/rss/:rssId', (req, res) => {
  const { rssId } = req.params;
  
  db.run('DELETE FROM rss_sources WHERE id = ?', [rssId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'RSS source deleted successfully' });
  });
});

// Update RSS source endpoint
app.put('/api/screens/:screenId/rss/:rssId', (req, res) => {
  const { rssId } = req.params;
  const { name, url, refresh_interval } = req.body;
  
  db.run(
    'UPDATE rss_sources SET name = ?, url = ?, refresh_interval = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, url, refresh_interval, rssId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'RSS source updated successfully' });
    }
  );
});

// Delete running message endpoint
app.delete('/api/screens/:screenId/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  
  db.run('DELETE FROM running_messages WHERE id = ?', [messageId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Running message deleted successfully' });
  });
});

// Update running message endpoint
app.put('/api/screens/:screenId/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  const { message, content, speed } = req.body;
  const messageText = content || message; // Support both field names
  
  db.run(
    'UPDATE running_messages SET message = ?, speed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [messageText, speed, messageId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Running message updated successfully' });
    }
  );
});

// Toggle running message status endpoint
app.patch('/api/screens/:screenId/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  const { is_active } = req.body;
  
  db.run(
    'UPDATE running_messages SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [is_active, messageId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Running message status updated successfully' });
    }
  );
});

// Current time endpoint
app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    datetime: now.toISOString(),
    time: now.toLocaleTimeString('he-IL'),
    date: now.toLocaleDateString('he-IL'),
    timestamp: now.getTime()
  });
});

// Admin API endpoints
app.get('/api/admin/users', requireAuth, (req, res) => {
  logInfo('👥 בקשת רשימת משתמשים למנהל');
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מנהל');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה לגשת לרשימת משתמשים ללא הרשאה`, 'admin-users');
      return res.status(403).json({ error: 'אין לך הרשאה לגשת לרשימת משתמשים' });
    }
    
    db.all('SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY created_at DESC', (err, users) => {
      if (err) {
        logError(err, 'טעינת רשימת משתמשים');
        return res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
      }
      
      logSuccess(`נטענו ${users.length} משתמשים למנהל`);
      res.json(users);
    });
  });
});

app.delete('/api/admin/users/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  logInfo(`🗑️ בקשת מחיקת משתמש: ${userId}`);
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקת משתמש');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה למחוק משתמש ללא הרשאה`, 'delete-user');
      return res.status(403).json({ error: 'אין לך הרשאה למחוק משתמשים' });
    }
    
    // Don't allow deleting yourself
    if (userId === req.session.userId) {
      logError(`משתמש ${req.session.username} מנסה למחוק את עצמו`, 'delete-self');
      return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש הנוכחי' });
    }
    
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        logError(err, 'מחיקת משתמש');
        return res.status(500).json({ error: 'שגיאה במחיקת משתמש' });
      }
      
      if (this.changes === 0) {
        logError(`משתמש לא נמצא למחיקה: ${userId}`, 'delete-user');
        return res.status(404).json({ error: 'משתמש לא נמצא' });
      }
      
      logSuccess(`משתמש נמחק בהצלחה: ${userId}`);
      res.json({ message: 'משתמש נמחק בהצלחה' });
    });
  });
});

app.put('/api/admin/users/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  const { username, full_name, email, role, is_active } = req.body;
  logInfo(`✏️ בקשת עדכון משתמש: ${userId}`);
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון משתמש');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה לעדכן משתמש ללא הרשאה`, 'update-user');
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן משתמשים' });
    }
    
    db.run(
      'UPDATE users SET username = ?, full_name = ?, email = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [username, full_name, email, role, is_active, userId],
      function(err) {
        if (err) {
          logError(err, 'עדכון משתמש');
          return res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
        }
        
        if (this.changes === 0) {
          logError(`משתמש לא נמצא לעדכון: ${userId}`, 'update-user');
          return res.status(404).json({ error: 'משתמש לא נמצא' });
        }
        
        logSuccess(`משתמש עודכן בהצלחה: ${userId}`);
        res.json({ message: 'משתמש עודכן בהצלחה' });
      }
    );
  });
});

app.get('/api/admin/permissions', requireAuth, (req, res) => {
  logInfo('🔒 בקשת רשימת הרשאות למנהל');
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מנהל הרשאות');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה לגשת להרשאות ללא הרשאה`, 'admin-permissions');
      return res.status(403).json({ error: 'אין לך הרשאה לגשת להרשאות' });
    }
    
    db.all(`
      SELECT 
        sp.id,
        sp.user_id,
        sp.screen_id,
        sp.permission_type,
        sp.created_at,
        u.username as user_username,
        u.full_name as user_full_name,
        s.name as screen_name
      FROM screen_permissions sp
      INNER JOIN users u ON sp.user_id = u.id
      INNER JOIN screens s ON sp.screen_id = s.id
      ORDER BY sp.created_at DESC
    `, (err, permissions) => {
      if (err) {
        logError(err, 'טעינת רשימת הרשאות');
        return res.status(500).json({ error: 'שגיאה בטעינת הרשאות' });
      }
      
      logSuccess(`נטענו ${permissions.length} הרשאות למנהל`);
      res.json(permissions);
    });
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Screen connected:', socket.id);
  
  socket.on('join_screen', (screenId) => {
    socket.join(screenId);
    console.log(`Screen ${screenId} joined room`);
  });
  
  socket.on('disconnect', () => {
    console.log('Screen disconnected:', socket.id);
  });
});

// Scheduled tasks - עדכון זמן כל דקה
cron.schedule('* * * * *', () => {
  console.log('עדכון זמן לכל המסכים...');
  io.emit('time_update', {
    datetime: new Date().toISOString(),
    time: new Date().toLocaleTimeString('he-IL'),
    date: new Date().toLocaleDateString('he-IL')
  });
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logError(err, 'שגיאה כללית בשרת');
  res.status(500).json({ error: 'שגיאה בשרת' });
});

server.listen(PORT, '0.0.0.0', () => {
  logSuccess(`🚀 שרת מסכים דיגיטליים רץ על פורט ${PORT}`);
  logSuccess(`📱 פאנל ניהול: http://localhost:${PORT}/admin`);
  logSuccess(`🖥️  מסך לקוח: http://localhost:${PORT}/client`);
  logInfo('🔍 לוגים מפורטים מופעלים - תוכל לראות שגיאות בטרמינל');
  console.log(`\n🌐 === SERVER STARTED ===`);
  console.log(`📅 זמן: ${new Date().toISOString()}`);
  console.log(`🔗 פורט: ${PORT}`);
  console.log(`🌍 מאזין על: 0.0.0.0:${PORT}`);
  console.log(`✅ השרת מוכן לקבל בקשות`);
});