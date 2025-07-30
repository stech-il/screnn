const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./screens.db');

console.log('🔧 יצירת הרשאות מנהל לכל המסכים...\n');

// Get admin user
db.get('SELECT id FROM users WHERE username = ? AND role = ?', ['admin', 'super_admin'], (err, adminUser) => {
  if (err) {
    console.error('❌ שגיאה בקבלת משתמש מנהל:', err);
    return;
  }
  
  if (!adminUser) {
    console.error('❌ משתמש מנהל לא נמצא');
    return;
  }
  
  console.log('✅ משתמש מנהל נמצא:', adminUser.id);
  
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
        [permissionId, adminUser.id, screen.id, 'admin', adminUser.id],
        function(err) {
          if (err) {
            console.error(`❌ שגיאה ביצירת הרשאה למסך ${screen.name}:`, err);
            errorCount++;
          } else {
            if (this.changes > 0) {
              console.log(`✅ הרשאה נוצרה למסך: ${screen.name}`);
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
            console.log(`   📊 סה"כ הרשאות במערכת: ${createdCount + errorCount}`);
            
            // Verify total permissions
            db.get('SELECT COUNT(*) as count FROM user_screen_permissions', (err, row) => {
              if (err) {
                console.error('❌ שגיאה בספירת הרשאות:', err);
              } else {
                console.log(`   🔍 אימות: ${row.count} הרשאות במסד הנתונים`);
              }
              process.exit(0);
            });
          }
        }
      );
    });
  });
}); 