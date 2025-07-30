const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔧 יצירת הרשאות למשתמש saia...\n');

// Get user ID for saia
db.get('SELECT id FROM users WHERE username = ?', ['saia'], (err, user) => {
  if (err) {
    console.error('❌ שגיאה:', err);
    return;
  }
  
  if (!user) {
    console.error('❌ משתמש saia לא נמצא');
    return;
  }
  
  console.log(`✅ משתמש saia נמצא: ${user.id}`);
  
  // Get all screens
  db.all('SELECT id, name FROM screens', (err, screens) => {
    if (err) {
      console.error('❌ שגיאה:', err);
      return;
    }
    
    console.log(`📺 נמצאו ${screens.length} מסכים`);
    
    // Create permissions for each screen
    screens.forEach((screen, index) => {
      const sql = `
        INSERT OR IGNORE INTO user_screen_permissions 
        (id, user_id, screen_id, permission_type, granted_by, granted_at) 
        VALUES 
        (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      const params = [
        require('uuid').v4(),
        user.id,
        screen.id,
        'read',
        user.id
      ];
      
      db.run(sql, params, function(err) {
        if (err) {
          console.error(`❌ שגיאה למסך ${screen.name}:`, err);
        } else {
          if (this.changes > 0) {
            console.log(`✅ הרשאה נוצרה למסך: ${screen.name}`);
          } else {
            console.log(`ℹ️  הרשאה כבר קיימת למסך: ${screen.name}`);
          }
        }
        
        // Check if this is the last screen
        if (index === screens.length - 1) {
          console.log('\n🎉 סיום!');
          process.exit(0);
        }
      });
    });
  });
}); 