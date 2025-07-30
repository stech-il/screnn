const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./screens.db');

// פרטי המשתמש שנרצה לתת לו הרשאות
const USERNAME = 'saia';
const PERMISSION_TYPE = 'read'; // 'read', 'write', 'admin'

console.log(`🔧 יצירת הרשאות למשתמש ${USERNAME}...\n`);

// Get user
db.get('SELECT id, username FROM users WHERE username = ?', [USERNAME], (err, user) => {
  if (err) {
    console.error('❌ שגיאה בקבלת משתמש:', err);
    return;
  }
  
  if (!user) {
    console.error(`❌ משתמש ${USERNAME} לא נמצא`);
    return;
  }
  
  console.log(`✅ משתמש נמצא: ${user.username} (${user.id})`);
  
  // Get all screens
  db.all('SELECT id, name FROM screens', (err, screens) => {
    if (err) {
      console.error('❌ שגיאה בקבלת מסכים:', err);
      return;
    }
    
    console.log(`📺 נמצאו ${screens.length} מסכים`);
    
    let createdCount = 0;
    let errorCount = 0;
    
    screens.forEach((screen, index) => {
      const permissionId = uuidv4();
      
      db.run(
        'INSERT OR IGNORE INTO user_screen_permissions (id, user_id, screen_id, permission_type, granted_by, granted_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [permissionId, user.id, screen.id, PERMISSION_TYPE, user.id],
        function(err) {
          if (err) {
            console.error(`❌ שגיאה ביצירת הרשאה למסך ${screen.name}:`, err);
            errorCount++;
          } else {
            if (this.changes > 0) {
              console.log(`✅ הרשאה ${PERMISSION_TYPE} נוצרה למסך: ${screen.name}`);
              createdCount++;
            } else {
              console.log(`ℹ️  הרשאה כבר קיימת למסך: ${screen.name}`);
            }
          }
          
          // Check if this is the last screen
          if (index === screens.length - 1) {
            console.log(`\n🎉 סיום יצירת הרשאות:`);
            console.log(`   ✅ נוצרו: ${createdCount} הרשאות`);
            console.log(`   ❌ שגיאות: ${errorCount}`);
            console.log(`   📊 סה"כ הרשאות למשתמש ${USERNAME}: ${createdCount + errorCount}`);
            
            // Verify total permissions for this user
            db.get('SELECT COUNT(*) as count FROM user_screen_permissions WHERE user_id = ?', [user.id], (err, row) => {
              if (err) {
                console.error('❌ שגיאה בספירת הרשאות:', err);
              } else {
                console.log(`   🔍 אימות: ${row.count} הרשאות למשתמש ${USERNAME} במסד הנתונים`);
              }
              process.exit(0);
            });
          }
        }
      );
    });
  });
}); 