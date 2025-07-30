const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'screens.db'));

console.log('🔍 בודק משתמשים והרשאות...');

// Check users
db.all('SELECT id, username, role FROM users', (err, users) => {
  if (err) {
    console.error('❌ שגיאה בטעינת משתמשים:', err);
    return;
  }
  
  console.log('👥 משתמשים:', users);
  
  // Check screens
  db.all('SELECT id, name FROM screens', (err, screens) => {
    if (err) {
      console.error('❌ שגיאה בטעינת מסכים:', err);
      return;
    }
    
    console.log('📺 מסכים:', screens);
    
    // Check permissions
    db.all('SELECT user_id, screen_id, permission_type FROM screen_permissions', (err, permissions) => {
      if (err) {
        console.error('❌ שגיאה בטעינת הרשאות:', err);
        return;
      }
      
      console.log('🔒 הרשאות:', permissions);
      db.close();
    });
  });
});