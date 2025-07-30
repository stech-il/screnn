const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔍 בדיקת הרשאות של משתמש saia...\n');

// Get user saia
db.get('SELECT id, username FROM users WHERE username = ?', ['saia'], (err, user) => {
  if (err) {
    console.error('❌ שגיאה בקבלת משתמש:', err);
    return;
  }
  
  if (!user) {
    console.error('❌ משתמש saia לא נמצא');
    return;
  }
  
  console.log(`✅ משתמש נמצא: ${user.username} (${user.id})`);
  
  // Check permissions
  db.all('SELECT * FROM user_screen_permissions WHERE user_id = ?', [user.id], (err, permissions) => {
    if (err) {
      console.error('❌ שגיאה בקבלת הרשאות:', err);
      return;
    }
    
    console.log(`📋 נמצאו ${permissions.length} הרשאות למשתמש saia:`);
    
    permissions.forEach((permission, index) => {
      console.log(`   ${index + 1}. מסך: ${permission.screen_id}, הרשאה: ${permission.permission_type}`);
    });
    
    if (permissions.length === 0) {
      console.log('❌ אין הרשאות למשתמש saia');
    }
    
    process.exit(0);
  });
}); 