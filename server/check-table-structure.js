const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔍 בדיקת מבנה טבלת running_messages...\n');

// Check table structure
db.all("PRAGMA table_info(running_messages)", (err, columns) => {
  if (err) {
    console.error('❌ שגיאה בבדיקת מבנה הטבלה:', err);
    return;
  }
  
  console.log('📋 מבנה טבלת running_messages:');
  columns.forEach(column => {
    console.log(`   - ${column.name} (${column.type}) ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Check if table has data
  db.get('SELECT COUNT(*) as count FROM running_messages', (err, row) => {
    if (err) {
      console.error('❌ שגיאה בספירת רשומות:', err);
      return;
    }
    
    console.log(`\n📊 מספר רשומות בטבלה: ${row.count}`);
    
    if (row.count > 0) {
      // Show sample data
      db.all('SELECT * FROM running_messages LIMIT 3', (err, rows) => {
        if (err) {
          console.error('❌ שגיאה בטעינת נתונים:', err);
          return;
        }
        
        console.log('\n📄 נתונים לדוגמה:');
        rows.forEach((row, index) => {
          console.log(`   רשומה ${index + 1}:`, row);
        });
      });
    }
  });
}); 