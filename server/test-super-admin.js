const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'screens.db');
const SERVER_URL = 'http://localhost:3001';

async function testSuperAdminAccess() {
  console.log('🧪 בודק פונקציונליות Super Admin...\n');
  
  // First, let's check the database directly
  const db = new sqlite3.Database(DB_PATH);
  
  console.log('📊 מצב נוכחי במסד הנתונים:');
  
  // Check users
  db.all('SELECT id, username, role FROM users', (err, users) => {
    if (err) {
      console.error('❌ שגיאה בטעינת משתמשים:', err);
      return;
    }
    
    console.log('\n👥 משתמשים:');
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.role}) - ID: ${user.id.substring(0, 8)}...`);
    });
    
    // Check current permissions
    db.all(`
      SELECT sp.user_id, sp.screen_id, sp.permission_type, u.username, s.name as screen_name
      FROM screen_permissions sp
      JOIN users u ON sp.user_id = u.id
      JOIN screens s ON sp.screen_id = s.id
      ORDER BY u.username, s.name
    `, (err, permissions) => {
      if (err) {
        console.error('❌ שגיאה בטעינת הרשאות:', err);
        return;
      }
      
      console.log('\n🔒 הרשאות נוכחיות:');
      if (permissions.length === 0) {
        console.log('  אין הרשאות מוגדרות');
      } else {
        permissions.forEach(perm => {
          console.log(`  - ${perm.username} → ${perm.screen_name} (${perm.permission_type})`);
        });
      }
      
      // Test the API
      testAPI();
      
      db.close();
    });
  });
}

async function testAPI() {
  console.log('\n🌐 בודק API...');
  
  try {
    // Try to login as admin
    const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('✅ התחברות מוצלחת כמנהל על');
    
    // Get the session cookie
    const cookies = loginResponse.headers['set-cookie'];
    const sessionCookie = cookies ? cookies[0].split(';')[0] : '';
    
    // Try to call the grant permissions API
    const grantResponse = await axios.post(
      `${SERVER_URL}/api/admin/grant-super-admin-access`,
      {},
      {
        headers: {
          'Cookie': sessionCookie
        }
      }
    );
    
    console.log('✅ API הענקת הרשאות עובד:', grantResponse.data.message);
    
    // Check screens access
    const screensResponse = await axios.get(
      `${SERVER_URL}/api/user/screens`,
      {
        headers: {
          'Cookie': sessionCookie
        }
      }
    );
    
    console.log(`✅ גישה למסכים: ${screensResponse.data.length} מסכים נגישים`);
    screensResponse.data.forEach(screen => {
      console.log(`  - ${screen.name} (${screen.permission_type || 'מנהל על'})`);
    });
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת API:', error.response?.data || error.message);
  }
}

// Run the test
testSuperAdminAccess();
