const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('🔍 בדיקת מבנה טבלת user_screen_permissions...\n');

// Check table structure
db.all("PRAGMA table_info(user_screen_permissions)", (err, columns) => {
  if (err) {
    console.error('❌ שגיאה בבדיקת מבנה הטבלה:', err);
    return;
  }
  
  console.log('📋 מבנה טבלת user_screen_permissions:');
  columns.forEach(column => {
    console.log(`   - ${column.name} (${column.type}) ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Check if table has data
  db.get('SELECT COUNT(*) as count FROM user_screen_permissions', (err, row) => {
    if (err) {
      console.error('❌ שגיאה בספירת רשומות:', err);
      return;
    }
    
    console.log(`\n📊 מספר רשומות בטבלה: ${row.count}`);
    
    if (row.count > 0) {
      // Show sample data
      db.all('SELECT * FROM user_screen_permissions LIMIT 3', (err, rows) => {
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

// Test the query that's failing
console.log('\n🧪 בדיקת השאילתה שנכשלת...');
const testQuery = `
  SELECT 
    up.id,
    up.user_id,
    up.screen_id,
    up.permission_type,
    up.granted_at,
    u.username as user_username,
    u.full_name as user_full_name,
    s.name as screen_name,
    g.username as granted_by_username
  FROM user_screen_permissions up
  JOIN users u ON up.user_id = u.id
  JOIN screens s ON up.screen_id = s.id
  LEFT JOIN users g ON up.granted_by = g.id
  ORDER BY up.granted_at DESC
`;

db.all(testQuery, (err, results) => {
  if (err) {
    console.error('❌ שגיאה בשאילתה:', err.message);
    console.error('   קוד שגיאה:', err.code);
  } else {
    console.log('✅ השאילתה הצליחה, מספר תוצאות:', results.length);
    if (results.length > 0) {
      console.log('   תוצאה ראשונה:', results[0]);
    }
  }
}); 