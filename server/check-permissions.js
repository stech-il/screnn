const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔍 בדיקת הרשאות במסד הנתונים...\n');

// Check if user_screen_permissions table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_screen_permissions'", (err, row) => {
  if (err) {
    console.error('❌ שגיאה בבדיקת טבלת הרשאות:', err);
    return;
  }
  
  if (!row) {
    console.log('❌ טבלת user_screen_permissions לא קיימת');
    return;
  }
  
  console.log('✅ טבלת user_screen_permissions קיימת');
  
  // Check permissions count
  db.get('SELECT COUNT(*) as count FROM user_screen_permissions', (err, row) => {
    if (err) {
      console.error('❌ שגיאה בספירת הרשאות:', err);
      return;
    }
    
    console.log(`📊 מספר הרשאות במסד הנתונים: ${row.count}`);
    
    if (row.count === 0) {
      console.log('⚠️  אין הרשאות מוגדרות - זה הסיבה לשגיאות 500');
      console.log('💡 צריך ליצור הרשאות או להסיר את ההגנה הזמנית');
    } else {
      // Show all permissions
      db.all('SELECT * FROM user_screen_permissions', (err, rows) => {
        if (err) {
          console.error('❌ שגיאה בטעינת הרשאות:', err);
          return;
        }
        
        console.log('\n📋 הרשאות קיימות:');
        rows.forEach(permission => {
          console.log(`   - משתמש: ${permission.user_id}, מסך: ${permission.screen_id}, הרשאה: ${permission.permission_type}`);
        });
      });
    }
  });
});

// Check screens
db.all('SELECT id, name FROM screens', (err, rows) => {
  if (err) {
    console.error('❌ שגיאה בטעינת מסכים:', err);
    return;
  }
  
  console.log(`\n🖥️  מספר מסכים במערכת: ${rows.length}`);
  rows.forEach(screen => {
    console.log(`   - ${screen.name} (${screen.id})`);
  });
});

// Check users
db.all('SELECT id, username, role FROM users', (err, rows) => {
  if (err) {
    console.error('❌ שגיאה בטעינת משתמשים:', err);
    return;
  }
  
  console.log(`\n👥 מספר משתמשים במערכת: ${rows.length}`);
  rows.forEach(user => {
    console.log(`   - ${user.username} (${user.role})`);
  });
  
  console.log('\n🎯 סיכום:');
  console.log('   אם אין הרשאות מוגדרות, צריך ליצור הרשאות או להסיר את ההגנה הזמנית');
  console.log('   כדי לאפשר גישה למסכים ללא הרשאות ספציפיות');
}); 