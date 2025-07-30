const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database(path.join(__dirname, 'screens.db'));

console.log('🔧 מתקן הרשאות למסכים קיימים...');

// Get all screens
db.all('SELECT id, name FROM screens', (err, screens) => {
  if (err) {
    console.error('❌ שגיאה בטעינת מסכים:', err);
    return;
  }
  
  console.log(`📺 נמצאו ${screens.length} מסכים`);
  
  // Get all admins
  db.all('SELECT id, username, role FROM users WHERE role IN (?, ?)', ['admin', 'super_admin'], (err, admins) => {
    if (err) {
      console.error('❌ שגיאה בטעינת מנהלים:', err);
      return;
    }
    
    console.log(`👥 נמצאו ${admins.length} מנהלים`);
    
    let completed = 0;
    let total = screens.length * admins.length;
    
    screens.forEach(screen => {
      admins.forEach(admin => {
        // Check if permission already exists
        db.get(
          'SELECT id FROM screen_permissions WHERE user_id = ? AND screen_id = ?',
          [admin.id, screen.id],
          (err, existing) => {
            if (err) {
              console.error(`❌ שגיאה בבדיקת הרשאה קיימת: ${err.message}`);
              completed++;
              if (completed === total) {
                console.log('✅ סיום תיקון הרשאות');
                db.close();
              }
              return;
            }
            
            if (!existing) {
              // Create permission
              db.run(
                'INSERT INTO screen_permissions (id, user_id, screen_id, permission_type) VALUES (?, ?, ?, ?)',
                [uuidv4(), admin.id, screen.id, 'admin'],
                function(err) {
                  if (err) {
                    console.error(`❌ שגיאה ביצירת הרשאה: ${err.message}`);
                  } else {
                    console.log(`✅ נוצרה הרשאה: ${admin.username} -> ${screen.name}`);
                  }
                  completed++;
                  if (completed === total) {
                    console.log('✅ סיום תיקון הרשאות');
                    db.close();
                  }
                }
              );
            } else {
              console.log(`ℹ️ הרשאה קיימת: ${admin.username} -> ${screen.name}`);
              completed++;
              if (completed === total) {
                console.log('✅ סיום תיקון הרשאות');
                db.close();
              }
            }
          }
        );
      });
    });
  });
});