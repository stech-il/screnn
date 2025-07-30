const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔧 תיקון מבנה טבלת user_screen_permissions...\n');

// Drop the old table and create new one with correct structure
db.serialize(() => {
  console.log('1. מחיקת טבלה ישנה...');
  db.run('DROP TABLE IF EXISTS user_screen_permissions', (err) => {
    if (err) {
      console.error('❌ שגיאה במחיקת טבלה:', err);
      return;
    }
    console.log('✅ טבלה ישנה נמחקה');
    
    console.log('\n2. יצירת טבלה חדשה עם מבנה נכון...');
    const createTableQuery = `
      CREATE TABLE user_screen_permissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        screen_id TEXT NOT NULL,
        permission_type TEXT NOT NULL, -- 'read', 'write', 'admin'
        granted_by TEXT,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (screen_id) REFERENCES screens (id),
        FOREIGN KEY (granted_by) REFERENCES users (id),
        UNIQUE(user_id, screen_id)
      )
    `;
    
    db.run(createTableQuery, (err) => {
      if (err) {
        console.error('❌ שגיאה ביצירת טבלה:', err);
        return;
      }
      console.log('✅ טבלה חדשה נוצרה');
      
      console.log('\n3. בדיקת מבנה הטבלה החדשה...');
      db.all("PRAGMA table_info(user_screen_permissions)", (err, columns) => {
        if (err) {
          console.error('❌ שגיאה בבדיקת מבנה:', err);
          return;
        }
        
        console.log('📋 מבנה טבלה חדש:');
        columns.forEach(column => {
          console.log(`   - ${column.name} (${column.type}) ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        console.log('\n🎉 טבלת ההרשאות תוקנה בהצלחה!');
        console.log('   עכשיו אפשר ליצור הרשאות עם המבנה הנכון');
      });
    });
  });
}); 