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
const nodemailer = require('nodemailer');

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
    origin: ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
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
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname);

// Middleware
app.set('trust proxy', 1);
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie', 'X-Requested-With'],
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
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), {
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

// Serve SPA index files for client-side routing
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-panel/build/index.html'));
});

app.get('/client/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-app/build/index.html'));
});

// Session configuration
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: DATA_DIR,
    table: 'sessions'
  }),
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  },
  name: 'connect.sid'
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
const db = new sqlite3.Database(path.join(DATA_DIR, 'screens.db'));

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
    last_seen_timestamp INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Add last_seen_timestamp column if it doesn't exist (for existing databases)
  db.run('ALTER TABLE screens ADD COLUMN last_seen_timestamp INTEGER', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('Error adding column (probably already exists):', err.message);
    }
  });

  // Add logo_url column if it doesn't exist (for existing databases)
  db.run('ALTER TABLE screens ADD COLUMN logo_url TEXT', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('Error adding logo_url column (probably already exists):', err.message);
    }
  });

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

  // Password reset tokens
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Application settings (key/value)
  db.run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
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

  // Function permissions table
  db.run(`CREATE TABLE IF NOT EXISTS function_permissions (
    user_id TEXT PRIMARY KEY,
    functions TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
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
    cb(null, path.join(DATA_DIR, 'uploads'));
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
      
      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          logError(err, 'שמירת session');
          return res.status(500).json({ error: 'שגיאה בשמירת session' });
        }
        
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
      });
    } catch (error) {
      logError(error, 'התחברות - שגיאה כללית');
      res.status(500).json({ error: 'שגיאה בשרת' });
    }
  });
});

// Password reset request
app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'נדרש אימייל' });

  db.get('SELECT id, username, email FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'שגיאה בשרת' });
    // השב תמיד 200 כדי לא לחשוף אם המייל קיים
    if (!user) return res.json({ message: 'אם המייל קיים במערכת תישלח הודעה' });

    // צור טוקן
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // שעה

    db.run(
      'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, token, expiresAt],
      async (insertErr) => {
        if (insertErr) return res.status(500).json({ error: 'שגיאה ביצירת בקשת איפוס' });

        try {
          // Load SMTP settings from env or DB settings
          const settings = await new Promise((resolve) => {
            db.all('SELECT key, value FROM app_settings WHERE key IN ("SMTP_USER","SMTP_PASS","SMTP_FROM")', (e, rows) => {
              const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
              resolve(map);
            });
          });
          const smtpUser = process.env.SMTP_USER || settings.SMTP_USER;
          const smtpPass = process.env.SMTP_PASS || settings.SMTP_PASS;
          const smtpFrom = process.env.SMTP_FROM || settings.SMTP_FROM || smtpUser;
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPass }
          });
          const baseUrl = process.env.PUBLIC_URL || await new Promise((resolve) => {
            db.get('SELECT value FROM app_settings WHERE key = ?', ['PUBLIC_URL'], (e, row) => {
              resolve((row && row.value) || `http://localhost:${PORT}`);
            });
          });
          const resetUrl = `${baseUrl}/admin/reset?token=${encodeURIComponent(token)}`;
          await transporter.sendMail({
            from: smtpFrom,
            to: user.email,
            subject: 'איפוס סיסמה - Digitlex',
            html: `<p>שלום ${user.username},</p><p>כדי לאפס סיסמה לחץ על הקישור:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>הקישור תקף לשעה.</p>`
          });
        } catch (mailErr) {
          logError(mailErr, 'שליחת מייל איפוס');
          // גם במקרה כשל דוא"ל נשיב 200 כדי לא לחשוף
        }

        res.json({ message: 'אם המייל קיים במערכת תישלח הודעה' });
      }
    );
  });
});

// Password reset confirm
app.post('/api/auth/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'טוקן וסיסמה נדרשים' });

  db.get('SELECT pr.user_id FROM password_resets pr WHERE pr.token = ? AND pr.expires_at > CURRENT_TIMESTAMP', [token], async (err, row) => {
    if (err) return res.status(500).json({ error: 'שגיאה בשרת' });
    if (!row) return res.status(400).json({ error: 'טוקן לא תקף או פג תוקף' });

    try {
      const hash = await bcrypt.hash(password, 10);
      db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, row.user_id], (updErr) => {
        if (updErr) return res.status(500).json({ error: 'שגיאה בעדכון סיסמה' });
        db.run('DELETE FROM password_resets WHERE token = ?', [token]);
        res.json({ message: 'סיסמה אופסה בהצלחה' });
      });
    } catch (e) {
      res.status(500).json({ error: 'שגיאה בעיבוד הסיסמה' });
    }
  });
});

// Change password (authenticated)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'סיסמה חדשה נדרשת' });

  db.get('SELECT password, role FROM users WHERE id = ?', [req.session.userId], async (err, row) => {
    if (err) return res.status(500).json({ error: 'שגיאה בשרת' });
    if (!row) return res.status(404).json({ error: 'משתמש לא נמצא' });

    try {
      // אם סופקה סיסמה נוכחית, ודא שהיא תקינה; למנהלים מותר בלי בדיקה אם current_password לא סופקה
      if (current_password) {
        const ok = await bcrypt.compare(current_password, row.password);
        if (!ok) return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
      }
      const hash = await bcrypt.hash(new_password, 10);
      db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.session.userId], (e2) => {
        if (e2) return res.status(500).json({ error: 'שגיאה בעדכון סיסמה' });
        res.json({ message: 'סיסמה עודכנה בהצלחה' });
      });
    } catch (e) {
      res.status(500).json({ error: 'שגיאה בעיבוד הסיסמה' });
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

// Update screen logo (admin only)
app.put('/api/screens/:id/logo', requireAuth, (req, res) => {
  logInfo('🖼️ בקשת עדכון לוגו מסך');
  const { id } = req.params;
  const { logo_url } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון לוגו מסך');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logError(`משתמש ${req.session.username} מנסה לעדכן לוגו מסך ללא הרשאה`, 'update-screen-logo');
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן לוגו מסך' });
    }
    
    // Check if screen exists
    db.get('SELECT logo_url as old_logo FROM screens WHERE id = ?', [id], (err, screen) => {
      if (err) {
        logError(err, 'בדיקת קיום מסך לעדכון לוגו');
        return res.status(500).json({ error: 'שגיאה בבדיקת מסך' });
      }
      
      if (!screen) {
        logError(`מסך לא קיים: ${id}`, 'update-screen-logo');
        return res.status(404).json({ error: 'מסך לא נמצא' });
      }
      
      // Update screen logo
      db.run('UPDATE screens SET logo_url = ? WHERE id = ?', [logo_url, id], (err) => {
        if (err) {
          logError(err, 'עדכון לוגו מסך');
          return res.status(500).json({ error: 'שגיאה בעדכון לוגו' });
        }
        
        logSuccess(`לוגו מסך עודכן בהצלחה: "${screen.old_logo}" -> "${logo_url}" (${id}) על ידי ${req.session.username}`);
        
        // Emit to all connected clients
        io.emit('screen_logo_updated', { id, logo_url });
        
        res.json({
          message: 'לוגו מסך עודכן בהצלחה',
          logo_url
        });
      });
    });
  });
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

// Delete screen endpoint (admin only)
app.delete('/api/screens/:id', requireAuth, (req, res) => {
  logInfo('🗑️ בקשת מחיקת מסך');
  const { id } = req.params;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקת מסך');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      logWarn(`🚫 ניסיון מחיקת מסך ללא הרשאה: ${req.session.userId}`);
      return res.status(403).json({ error: 'אין הרשאה למחיקת מסכים' });
    }
    
    // Get screen name for logging
    db.get('SELECT name FROM screens WHERE id = ?', [id], (err, screen) => {
      if (err) {
        logError(err, 'טעינת פרטי מסך למחיקה');
        return res.status(500).json({ error: 'שגיאה בטעינת פרטי המסך' });
      }
      
      if (!screen) {
        return res.status(404).json({ error: 'מסך לא נמצא' });
      }
      
      // Start transaction to delete all related data
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Delete all content for this screen
        db.run('DELETE FROM content WHERE screen_id = ?', [id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logError(err, 'מחיקת תוכן מסך');
            return res.status(500).json({ error: 'שגיאה במחיקת תוכן המסך' });
          }
          
          // Delete all RSS sources for this screen
          db.run('DELETE FROM rss_sources WHERE screen_id = ?', [id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              logError(err, 'מחיקת RSS מסך');
              return res.status(500).json({ error: 'שגיאה במחיקת חדשות המסך' });
            }
            
            // Delete all running messages for this screen
            db.run('DELETE FROM running_messages WHERE screen_id = ?', [id], (err) => {
              if (err) {
                db.run('ROLLBACK');
                logError(err, 'מחיקת הודעות מסך');
                return res.status(500).json({ error: 'שגיאה במחיקת הודעות המסך' });
              }
              
              // Delete screen permissions
              db.run('DELETE FROM screen_permissions WHERE screen_id = ?', [id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  logError(err, 'מחיקת הרשאות מסך');
                  return res.status(500).json({ error: 'שגיאה במחיקת הרשאות המסך' });
                }
                
                // Finally delete the screen itself
                db.run('DELETE FROM screens WHERE id = ?', [id], function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    logError(err, 'מחיקת מסך');
                    return res.status(500).json({ error: 'שגיאה במחיקת המסך' });
                  }
                  
                  db.run('COMMIT');
                  logSuccess(`🗑️ מסך נמחק בהצלחה: ${screen.name} (${id})`);
                  
                  // Notify all clients about screen deletion
                  io.emit('screen_deleted', { id });
                  
                  res.json({ 
                    message: 'מסך נמחק בהצלחה',
                    deletedScreen: {
                      id,
                      name: screen.name
                    }
                  });
                });
              });
            });
          });
        });
      });
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
    
    if (row) {
      console.log(`🔍 מסך נמצא בDB: ${id}`);
      console.log(`📊 last_seen מהDB: ${row.last_seen} (typeof: ${typeof row.last_seen})`);
    }
    
    if (!row) {
      // Create screen automatically if it doesn't exist
      logInfo(`יצירת מסך חדש אוטומטית: ${id}`);
      const creationTime = new Date().toISOString();
      db.run(
        'INSERT INTO screens (id, name, location, last_seen) VALUES (?, ?, ?, ?)',
        [id, `מסך ${id.substring(0, 8)}`, 'לא צוין', creationTime],
        function(insertErr) {
          if (insertErr) {
            logError(insertErr, 'יצירת מסך אוטומטית');
            res.status(500).json({ error: insertErr.message });
            return;
          }
          
          // הרשאות למנהלים נוצרות אוטומטית - לא מעדכנים last_seen
          
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
      // לא מעדכנים last_seen כשגושים למסך דרך הפאנל - רק דרך heartbeat
      logInfo(`מסך קיים נמצא: ${row.name} (${id})`);
      
      const screenData = { ...row };
      console.log(`🔄 DB data - last_seen: ${screenData.last_seen}`);
      
      // תיקון הבעיה עם השעון המקומי של SQLite
      if (screenData.last_seen && !screenData.last_seen.includes('T')) {
        // זה פורמט SQLite מקומי: YYYY-MM-DD HH:MM:SS
        // SQLite שומר בזמן UTC אבל ללא סימון timezone
        const sqliteTime = screenData.last_seen + 'Z'; // הוספת Z להגדרה כ-UTC
        screenData.last_seen = new Date(sqliteTime).toISOString();
        console.log(`🔄 תיקון זמן SQLite: ${screenData.last_seen}`);
      }
      
      res.json(screenData);
    }
  });
});

// Screen heartbeat endpoint
app.post('/api/screens/:id/heartbeat', (req, res) => {
  const { id } = req.params;
  const currentTime = new Date().toISOString();
  
  // Check if this is a viewer (client) or admin panel request
  const userAgent = req.headers['user-agent'] || '';
  const isClientViewer = userAgent.includes('Electron') || 
                        req.headers.referer?.includes('/client') ||
                        !req.headers.referer?.includes('/admin');
  
  console.log(`\n💓 === HEARTBEAT RECEIVED ===`);
  console.log(`📅 זמן: ${currentTime}`);
  console.log(`🆔 מזהה מסך: ${id}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`👤 סוג: ${isClientViewer ? 'מסך צפייה' : 'פאנל ניהול'}`);
  console.log(`📊 User-Agent: ${userAgent}`);
  logInfo(`💓 heartbeat ממסך: ${id} (${isClientViewer ? 'צפייה' : 'ניהול'})`);
  
  // Only update last_seen for actual client viewers, not admin panel
  if (isClientViewer) {
    const currentTimeISO = new Date().toISOString();
    console.log(`💓 מעדכן last_seen למסך צפייה: ${currentTimeISO}`);
    db.run('UPDATE screens SET last_seen = ? WHERE id = ?', [currentTimeISO, id], function(err) {
      if (err) {
        logError(err, 'heartbeat - עדכון מסך צפייה');
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        // Screen doesn't exist, create it
        logInfo(`מסך צפייה לא קיים, יוצר חדש: ${id}`);
        db.run(
          'INSERT INTO screens (id, name, location, last_seen) VALUES (?, ?, ?, ?)',
          [id, `מסך ${id.substring(0, 8)}`, 'לא צוין', currentTimeISO],
          function(insertErr) {
            if (insertErr) {
              logError(insertErr, 'heartbeat - יצירת מסך צפייה');
              res.status(500).json({ error: insertErr.message });
              return;
            }
            
            // Give permissions to all admins for the new screen
            db.all('SELECT id FROM users WHERE role IN (?, ?)', ['admin', 'super_admin'], (err, admins) => {
              if (err) {
                logError(err, 'בדיקת מנהלים להרשאות אוטומטיות - heartbeat צפייה');
              } else {
                admins.forEach(admin => {
                  db.run(
                    'INSERT OR IGNORE INTO screen_permissions (id, user_id, screen_id, permission_type) VALUES (?, ?, ?, ?)',
                    [uuidv4(), admin.id, id, 'admin']
                  );
                });
                logInfo(`נוצרו הרשאות אוטומטיות למסך ${id} עבור ${admins.length} מנהלים (heartbeat צפייה)`);
              }
            });
            
            logSuccess(`מסך צפייה נוצר ועודכן: ${id}`);
            const currentTime = new Date().toISOString();
            console.log(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
            logInfo(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
            io.emit('screen_status_updated', { id, last_seen: currentTime });
            res.json({ message: 'מסך צפייה נוצר ועודכן', created: true });
          }
        );
      } else {
        logInfo(`סטטוס מסך צפייה עודכן: ${id}`);
        const currentTime = new Date().toISOString();
        console.log(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
        logInfo(`📡 שולח screen_status_updated: ${id} - ${currentTime}`);
        io.emit('screen_status_updated', { id, last_seen: currentTime });
        console.log(`✅ Heartbeat הושלם - סטטוס מסך צפייה עודכן`);
        res.json({ message: 'סטטוס מסך צפייה עודכן', created: false });
      }
    });
  } else {
    // Admin panel heartbeat - just confirm without updating last_seen
    console.log(`📊 heartbeat מפאנל ניהול - לא מעדכן last_seen`);
    logInfo(`heartbeat מפאנל ניהול למסך ${id} - לא מעדכן זמן`);
    res.json({ message: 'heartbeat מפאנל ניהול התקבל', updated: false });
  }
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

// Settings endpoints (admin only)
app.get('/api/admin/settings', requireAuth, (req, res) => {
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לגשת להגדרות' });
    }
    db.all('SELECT key, value FROM app_settings', (e, rows) => {
      if (e) return res.status(500).json({ error: 'שגיאה בטעינת הגדרות' });
      const settings = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
      res.json(settings);
    });
  });
});

app.post('/api/admin/settings', requireAuth, (req, res) => {
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן הגדרות' });
    }

    const allowedKeys = ['PUBLIC_URL', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'DATA_DIR'];
    const entries = Object.entries(req.body || {}).filter(([k]) => allowedKeys.includes(k));
    if (entries.length === 0) return res.json({ message: 'אין שינויים' });

    db.serialize(() => {
      const stmt = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      for (const [k, v] of entries) {
        stmt.run(k, v == null ? '' : String(v));
      }
      stmt.finalize((e) => {
        if (e) return res.status(500).json({ error: 'שגיאה בשמירת הגדרות' });
        res.json({ message: 'הגדרות נשמרו' });
      });
    });
  });
});

// Create user (admin only)
app.post('/api/admin/users', requireAuth, async (req, res) => {
  logInfo('👤 בקשת יצירת משתמש חדש');
  const { username, password, full_name, email, role = 'user', is_active = 1 } = req.body;

  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות יצירת משתמש');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה ליצור משתמשים' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
    }

    try {
      const hashed = await bcrypt.hash(password, 10);
      const newUserId = uuidv4();
      db.run(
        'INSERT INTO users (id, username, password, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newUserId, username, hashed, full_name || null, email || null, role, is_active ? 1 : 0],
        function(insertErr) {
          if (insertErr) {
            if (insertErr.message && insertErr.message.includes('UNIQUE')) {
              return res.status(409).json({ error: 'שם המשתמש כבר קיים' });
            }
            logError(insertErr, 'יצירת משתמש חדש');
            return res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
          }
          logSuccess(`משתמש חדש נוצר: ${username} (${newUserId})`);
          io.emit('users_updated');

          // שליחת מייל פרטי התחברות אם קיים אימייל
          if (email) {
            (async () => {
              try {
                // קרא הגדרות SMTP & URL
                const settings = await new Promise((resolve) => {
                  db.all('SELECT key, value FROM app_settings WHERE key IN ("SMTP_USER","SMTP_PASS","SMTP_FROM","PUBLIC_URL")', (e, rows) => {
                    const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
                    resolve(map);
                  });
                });
                const smtpUser = process.env.SMTP_USER || settings.SMTP_USER;
                const smtpPass = process.env.SMTP_PASS || settings.SMTP_PASS;
                const smtpFrom = process.env.SMTP_FROM || settings.SMTP_FROM || smtpUser;
                const baseUrl = process.env.PUBLIC_URL || settings.PUBLIC_URL || `http://localhost:${PORT}`;
                if (smtpUser && smtpPass && smtpFrom) {
                  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
                  const html = `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:10px">
                      <div style="background:#001529;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
                        <h2 style="margin:0">ברוך הבא ל‑Digitlex</h2>
                      </div>
                      <div style="padding:20px">
                        <p>שלום ${full_name || username},</p>
                        <p>נוצר עבורך חשבון גישה למערכת ניהול המסכים.</p>
                        <table style="width:100%;border-collapse:collapse;margin:10px 0">
                          <tr><td style="width:140px;color:#555">כתובת גישה:</td><td><a href="${baseUrl}/admin" target="_blank">${baseUrl}/admin</a></td></tr>
                          <tr><td style="color:#555">שם משתמש:</td><td><b>${username}</b></td></tr>
                          <tr><td style="color:#555">סיסמה ראשונית:</td><td><b>${password}</b></td></tr>
                        </table>
                        <p>מומלץ להחליף סיסמה לאחר ההתחברות (תפריט משתמש → שינוי סיסמה).</p>
                        <p style="color:#888;font-size:12px">אם לא ציפית להודעה זו, התעלם ממנה.</p>
                      </div>
                    </div>`;
                  await transporter.sendMail({ from: smtpFrom, to: email, subject: 'פרטי גישה למערכת Digitlex', html });
                } else {
                  logInfo('SMTP not configured; skipped welcome email');
                }
              } catch (e) {
                logError(e, 'שליחת מייל פרטי גישה');
              }
            })();
          }

          res.json({ id: newUserId, message: 'משתמש נוצר בהצלחה' });
        }
      );
    } catch (hashErr) {
      logError(hashErr, 'האשת סיסמה');
      return res.status(500).json({ error: 'שגיאה בעיבוד הסיסמה' });
    }
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
      io.emit('users_updated');
      res.json({ message: 'משתמש נמחק בהצלחה' });
    });
  });
});

app.put('/api/admin/users/:userId', requireAuth, (req, res) => {
  const { userId } = req.params;
  const { username, full_name, email, role, is_active, password } = req.body;
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
    
    const doUpdate = (passwordHash) => {
      const fields = ['username = ?', 'full_name = ?', 'email = ?', 'role = ?', 'is_active = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const values = [username, full_name, email, role, is_active];
      if (passwordHash) {
        fields.unshift('password = ?');
        values.unshift(passwordHash);
      }
      values.push(userId);
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'שם המשתמש כבר קיים' });
          }
          logError(err, 'עדכון משתמש');
          return res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
        }
        if (this.changes === 0) {
          logError(`משתמש לא נמצא לעדכון: ${userId}`, 'update-user');
          return res.status(404).json({ error: 'משתמש לא נמצא' });
        }
        logSuccess(`משתמש עודכן בהצלחה: ${userId}`);
        io.emit('users_updated');
        res.json({ message: 'משתמש עודכן בהצלחה' });
      });
    };

    if (password && String(password).trim().length > 0) {
      bcrypt.hash(password, 10).then(doUpdate).catch(err => {
        logError(err, 'האשת סיסמה בעדכון');
        res.status(500).json({ error: 'שגיאה בעיבוד הסיסמה' });
      });
    } else {
      doUpdate();
    }
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

// Create new permission (admin only)
app.post('/api/admin/permissions', requireAuth, (req, res) => {
  logInfo('➕ בקשת יצירת הרשאה חדשה');
  const { user_id, screen_id, permission_type } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות יצירת הרשאה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      logWarn(`ניסיון יצירת הרשאה ללא הרשאה: ${req.session.userId}`);
      return res.status(403).json({ error: 'אין לך הרשאה ליצור הרשאות' });
    }
    
    const permissionId = uuidv4();
    
    db.run(
      'INSERT OR REPLACE INTO screen_permissions (id, user_id, screen_id, permission_type, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [permissionId, user_id, screen_id, permission_type],
      function(err) {
        if (err) {
          logError(err, 'יצירת הרשאה חדשה');
          return res.status(500).json({ error: 'שגיאה ביצירת ההרשאה' });
        }
        
        logSuccess(`הרשאה חדשה נוצרה: ${permission_type} למשתמש ${user_id} במסך ${screen_id}`);
        res.json({ 
          message: 'הרשאה נוצרה בהצלחה',
          id: permissionId
        });
      }
    );
  });
});

// Update permission (admin only)
app.put('/api/admin/permissions/:permissionId', requireAuth, (req, res) => {
  logInfo('✏️ בקשת עדכון הרשאה');
  const { permissionId } = req.params;
  const { permission_type } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון הרשאה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      logWarn(`ניסיון עדכון הרשאה ללא הרשאה: ${req.session.userId}`);
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן הרשאות' });
    }
    
    db.run(
      'UPDATE screen_permissions SET permission_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [permission_type, permissionId],
      function(err) {
        if (err) {
          logError(err, 'עדכון הרשאה');
          return res.status(500).json({ error: 'שגיאה בעדכון ההרשאה' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'הרשאה לא נמצאה' });
        }
        
        logSuccess(`הרשאה עודכנה: ${permissionId} → ${permission_type}`);
        res.json({ message: 'הרשאה עודכנה בהצלחה' });
      }
    );
  });
});

// Delete permission (admin only)
app.delete('/api/admin/permissions/:permissionId', requireAuth, (req, res) => {
  logInfo('🗑️ בקשת מחיקת הרשאה');
  const { permissionId } = req.params;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקת הרשאה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      logWarn(`ניסיון מחיקת הרשאה ללא הרשאה: ${req.session.userId}`);
      return res.status(403).json({ error: 'אין לך הרשאה למחוק הרשאות' });
    }
    
    db.run(
      'DELETE FROM screen_permissions WHERE id = ?',
      [permissionId],
      function(err) {
        if (err) {
          logError(err, 'מחיקת הרשאה');
          return res.status(500).json({ error: 'שגיאה במחיקת ההרשאה' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'הרשאה לא נמצאה' });
        }
        
        logSuccess(`הרשאה נמחקה: ${permissionId}`);
        res.json({ message: 'הרשאה נמחקה בהצלחה' });
      }
    );
  });
});

// Function permissions endpoints

// Get all function permissions (admin only)
app.get('/api/admin/function-permissions', requireAuth, (req, res) => {
  logInfo('🔧 בקשת רשימת הרשאות פונקציות');
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות הרשאות פונקציות');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לגשת להרשאות פונקציות' });
    }
    
    // Get all users with their function permissions
    db.all(`
      SELECT 
        u.id as user_id,
        u.username,
        u.full_name,
        fp.functions,
        fp.updated_at
      FROM users u
      LEFT JOIN function_permissions fp ON u.id = fp.user_id
      WHERE u.role NOT IN ('admin', 'super_admin') AND u.is_active = 1
      ORDER BY u.username
    `, (err, permissions) => {
      if (err) {
        logError(err, 'טעינת הרשאות פונקציות');
        return res.status(500).json({ error: 'שגיאה בטעינת הרשאות פונקציות' });
      }
      
      // Parse functions JSON
      const parsedPermissions = permissions.map(perm => ({
        ...perm,
        functions: perm.functions ? JSON.parse(perm.functions) : []
      }));
      
      logSuccess(`נטענו הרשאות פונקציות עבור ${parsedPermissions.length} משתמשים`);
      res.json(parsedPermissions);
    });
  });
});

// Create/Update function permissions (admin only)
app.post('/api/admin/function-permissions', requireAuth, (req, res) => {
  logInfo('➕ בקשת יצירת הרשאות פונקציות');
  const { user_id, functions } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות יצירת הרשאות פונקציות');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה ליצור הרשאות פונקציות' });
    }
    
    const functionsJson = JSON.stringify(functions || []);
    
    db.run(
      'INSERT OR REPLACE INTO function_permissions (user_id, functions, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [user_id, functionsJson],
      function(err) {
        if (err) {
          logError(err, 'יצירת הרשאות פונקציות');
          return res.status(500).json({ error: 'שגיאה ביצירת הרשאות הפונקציות' });
        }
        
        logSuccess(`הרשאות פונקציות נוצרו למשתמש ${user_id}: ${functions?.join(', ')}`);
        res.json({ message: 'הרשאות פונקציות נוצרו בהצלחה' });
      }
    );
  });
});

// Update function permissions (admin only)
app.put('/api/admin/function-permissions/:userId', requireAuth, (req, res) => {
  logInfo('✏️ בקשת עדכון הרשאות פונקציות');
  const { userId } = req.params;
  const { functions } = req.body;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון הרשאות פונקציות');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן הרשאות פונקציות' });
    }
    
    const functionsJson = JSON.stringify(functions || []);
    
    db.run(
      'UPDATE function_permissions SET functions = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [functionsJson, userId],
      function(err) {
        if (err) {
          logError(err, 'עדכון הרשאות פונקציות');
          return res.status(500).json({ error: 'שגיאה בעדכון הרשאות הפונקציות' });
        }
        
        if (this.changes === 0) {
          // Create new if not exists
          db.run(
            'INSERT INTO function_permissions (user_id, functions, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [userId, functionsJson],
            function(err) {
              if (err) {
                logError(err, 'יצירת הרשאות פונקציות חדשות');
                return res.status(500).json({ error: 'שגיאה ביצירת הרשאות הפונקציות' });
              }
              
              logSuccess(`הרשאות פונקציות חדשות נוצרו למשתמש ${userId}`);
              res.json({ message: 'הרשאות פונקציות עודכנו בהצלחה' });
            }
          );
        } else {
          logSuccess(`הרשאות פונקציות עודכנו למשתמש ${userId}`);
          res.json({ message: 'הרשאות פונקציות עודכנו בהצלחה' });
        }
      }
    );
  });
});

// Delete function permissions (admin only)
app.delete('/api/admin/function-permissions/:userId', requireAuth, (req, res) => {
  logInfo('🗑️ בקשת מחיקת הרשאות פונקציות');
  const { userId } = req.params;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקת הרשאות פונקציות');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה למחוק הרשאות פונקציות' });
    }
    
    db.run(
      'DELETE FROM function_permissions WHERE user_id = ?',
      [userId],
      function(err) {
        if (err) {
          logError(err, 'מחיקת הרשאות פונקציות');
          return res.status(500).json({ error: 'שגיאה במחיקת הרשאות הפונקציות' });
        }
        
        logSuccess(`הרשאות פונקציות נמחקו למשתמש ${userId}`);
        res.json({ message: 'הרשאות פונקציות נמחקו בהצלחה' });
      }
    );
  });
});

// Update file sizes endpoint (admin only)
app.post('/api/admin/media-files/update-sizes', requireAuth, (req, res) => {
  logInfo('📊 בקשת עדכון משקלי קבצים');
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות עדכון משקלי קבצים');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לעדכן משקלי קבצים' });
    }
    
    // Get all media files from content table
    db.all(`
      SELECT 
        c.id as content_id,
        c.file_path,
        c.title,
        c.type,
        c.created_at,
        c.updated_at,
        s.name as screen_name,
        s.id as screen_id
      FROM content c
      JOIN screens s ON c.screen_id = s.id
      WHERE c.file_path IS NOT NULL AND c.file_path != ''
      ORDER BY c.created_at DESC
    `, [], (err, rows) => {
      if (err) {
        logError(err, 'קבלת רשימת קבצי מדיה לעדכון משקלים');
        return res.status(500).json({ error: 'שגיאה בקבלת רשימת קבצי מדיה' });
      }
      
      // Update file info for each media file
      const updatedFiles = rows.map(row => {
        const filePath = path.join(DATA_DIR, row.file_path.replace('/uploads/', ''));
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        
        return {
          ...row,
          file_exists: !!stats,
          file_size: stats ? stats.size : 0,
          file_size_formatted: stats ? formatFileSize(stats.size) : 'לא נמצא',
          last_modified: stats ? stats.mtime : null,
          full_path: row.file_path
        };
      });
      
      logSuccess(`עודכנו משקלי ${updatedFiles.length} קבצי מדיה`);
      res.json(updatedFiles);
    });
  });
});

// Media files management endpoints (admin only)
app.get('/api/admin/media-files', requireAuth, (req, res) => {
  logInfo('📁 בקשת רשימת קבצי מדיה');
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות רשימת קבצי מדיה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה לצפות בקבצי מדיה' });
    }
    
    // Get all media files from content table
    db.all(`
      SELECT 
        c.id as content_id,
        c.file_path,
        c.title,
        c.type,
        c.created_at,
        c.updated_at,
        s.name as screen_name,
        s.id as screen_id
      FROM content c
      JOIN screens s ON c.screen_id = s.id
      WHERE c.file_path IS NOT NULL AND c.file_path != ''
      ORDER BY c.created_at DESC
    `, [], (err, rows) => {
      if (err) {
        logError(err, 'קבלת רשימת קבצי מדיה');
        return res.status(500).json({ error: 'שגיאה בקבלת רשימת קבצי מדיה' });
      }
      
      // Add file info for each media file
      const mediaFiles = rows.map(row => {
        const filePath = path.join(DATA_DIR, row.file_path.replace('/uploads/', ''));
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        
        return {
          ...row,
          file_exists: !!stats,
          file_size: stats ? stats.size : 0,
          file_size_formatted: stats ? formatFileSize(stats.size) : 'לא נמצא',
          last_modified: stats ? stats.mtime : null,
          full_path: row.file_path
        };
      });
      
      logSuccess(`נמצאו ${mediaFiles.length} קבצי מדיה`);
      res.json(mediaFiles);
    });
  });
});

// Delete media file endpoint (admin only)
app.delete('/api/admin/media-files/:contentId', requireAuth, (req, res) => {
  logInfo(`🗑️ בקשת מחיקת קובץ מדיה: ${req.params.contentId}`);
  const { contentId } = req.params;
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקת קובץ מדיה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה למחוק קבצי מדיה' });
    }
    
    // Get content info first
    db.get(`
      SELECT c.*, s.name as screen_name 
      FROM content c 
      JOIN screens s ON c.screen_id = s.id 
      WHERE c.id = ?
    `, [contentId], (err, content) => {
      if (err) {
        logError(err, 'קבלת מידע על תוכן למחיקה');
        return res.status(500).json({ error: 'שגיאה בקבלת מידע על התוכן' });
      }
      
      if (!content) {
        return res.status(404).json({ error: 'תוכן לא נמצא' });
      }
      
      if (!content.file_path) {
        return res.status(400).json({ error: 'לתוכן זה אין קובץ מדיה' });
      }
      
      // Delete physical file
      const filePath = path.join(DATA_DIR, content.file_path.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logSuccess(`קובץ פיזי נמחק: ${filePath}`);
        } catch (fileErr) {
          logError(fileErr, 'מחיקת קובץ פיזי');
          // Continue with database deletion even if file deletion fails
        }
      }
      
      // Update content to remove file reference
      db.run(`
        UPDATE content 
        SET file_path = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [contentId], function(err) {
        if (err) {
          logError(err, 'עדכון תוכן לאחר מחיקת קובץ');
          return res.status(500).json({ error: 'שגיאה בעדכון התוכן' });
        }
        
        // Notify connected screens
        io.to(content.screen_id).emit('content_updated');
        
        logSuccess(`קובץ מדיה נמחק בהצלחה: ${content.file_path}`);
        res.json({ 
          message: 'קובץ מדיה נמחק בהצלחה',
          deleted_file: content.file_path,
          screen_name: content.screen_name
        });
      });
    });
  });
});

// Bulk delete media files endpoint (admin only)
app.delete('/api/admin/media-files', requireAuth, (req, res) => {
  logInfo('🗑️ בקשת מחיקה מרובה של קבצי מדיה');
  const { contentIds } = req.body;
  
  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return res.status(400).json({ error: 'רשימת מזההי תוכן נדרשת' });
  }
  
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      logError(err, 'בדיקת הרשאות מחיקה מרובה של קבצי מדיה');
      return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות' });
    }
    
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'אין לך הרשאה למחוק קבצי מדיה' });
    }
    
    // Get all content info first
    db.all(`
      SELECT c.*, s.name as screen_name 
      FROM content c 
      JOIN screens s ON c.screen_id = s.id 
      WHERE c.id IN (${contentIds.map(() => '?').join(',')})
    `, contentIds, (err, contents) => {
      if (err) {
        logError(err, 'קבלת מידע על תוכן למחיקה מרובה');
        return res.status(500).json({ error: 'שגיאה בקבלת מידע על התוכן' });
      }
      
      let deletedFiles = 0;
      let deletedBytes = 0;
      const screenIds = new Set();
      
      // Delete physical files and update database
      contents.forEach(content => {
        if (content.file_path) {
          const filePath = path.join(DATA_DIR, content.file_path.replace('/uploads/', ''));
          if (fs.existsSync(filePath)) {
            try {
              const stats = fs.statSync(filePath);
              deletedBytes += stats.size;
              fs.unlinkSync(filePath);
              deletedFiles++;
              logSuccess(`קובץ פיזי נמחק: ${filePath}`);
            } catch (fileErr) {
              logError(fileErr, 'מחיקת קובץ פיזי');
            }
          }
          screenIds.add(content.screen_id);
        }
      });
      
      // Update all content to remove file references
      db.run(`
        UPDATE content 
        SET file_path = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id IN (${contentIds.map(() => '?').join(',')})
      `, contentIds, function(err) {
        if (err) {
          logError(err, 'עדכון תוכן לאחר מחיקה מרובה של קבצים');
          return res.status(500).json({ error: 'שגיאה בעדכון התוכן' });
        }
        
        // Notify all affected screens
        screenIds.forEach(screenId => {
          io.to(screenId).emit('content_updated');
        });
        
        logSuccess(`${deletedFiles} קבצי מדיה נמחקו בהצלחה`);
        res.json({ 
          message: `${deletedFiles} קבצי מדיה נמחקו בהצלחה`,
          deleted_files: deletedFiles,
          deleted_bytes: deletedBytes,
          deleted_bytes_formatted: formatFileSize(deletedBytes),
          affected_screens: screenIds.size
        });
      });
    });
  });
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
const uploadsDir = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logError(err, 'שגיאה כללית בשרת');
  res.status(500).json({ error: 'שגיאה בשרת' });
});

server.listen(PORT, () => {
  logSuccess(`🚀 שרת מסכים דיגיטליים רץ על פורט ${PORT}`);
  logSuccess(`📱 פאנל ניהול: http://localhost:${PORT}/admin`);
  logSuccess(`🖥️  מסך לקוח: http://localhost:${PORT}/client`);
  logInfo('🔍 לוגים מפורטים מופעלים - תוכל לראות שגיאות בטרמינל');
  console.log(`\n🌐 === SERVER STARTED ===`);
  console.log(`📅 זמן: ${new Date().toISOString()}`);
  console.log(`🔗 פורט: ${PORT}`);
  console.log(`🌍 מאזין על: IPv4 + IPv6 פורט ${PORT}`);
  console.log(`✅ השרת מוכן לקבל בקשות`);
});