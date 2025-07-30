const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./screens.db');

async function initializeUsers() {
  try {
    // Create users table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        role TEXT DEFAULT 'admin',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if admin user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingUser) {
      // Create default admin user
      const passwordHash = await bcrypt.hash('admin123', 10);
      const userId = uuidv4();
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, 'admin', passwordHash, 'מנהל מערכת', 'admin@example.com', 'admin'],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log('✅ משתמש מנהל נוצר בהצלחה!');
      console.log('שם משתמש: admin');
      console.log('סיסמה: admin123');
      console.log('⚠️  חשוב: שנה את הסיסמה לאחר ההתחברות הראשונה!');
    } else {
      console.log('✅ משתמש מנהל כבר קיים במערכת');
    }

    // Create user_sessions table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ טבלאות משתמשים נוצרו בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה באתחול משתמשים:', error);
  } finally {
    db.close();
  }
}

initializeUsers(); 