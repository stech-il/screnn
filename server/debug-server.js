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

console.log('1. Loading modules...');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

console.log('2. Created server...');

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Set-Cookie']
}));
app.use(express.json());

console.log('3. Added middleware...');

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  },
  name: 'sid'
}));

console.log('4. Added session...');

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Digital Signage Server'
  });
});

console.log('5. Added health endpoint...');

// Database setup
console.log('6. Opening database...');
const db = new sqlite3.Database('./screens.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('7. Database opened successfully');
  
  // Simple table check
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
    if (err) {
      console.error('Error checking users table:', err);
    } else {
      console.log('8. Users table exists:', !!row);
    }
  });
});

console.log('9. Starting server...');

server.listen(PORT, () => {
  console.log(`🚀 שרת מסכים דיגיטליים רץ על פורט ${PORT}`);
  console.log(`📱 פאנל ניהול: http://localhost:${PORT}/admin`);
  console.log(`🖥️  מסך לקוח: http://localhost:${PORT}/client`);
});

console.log('10. Server setup complete'); 