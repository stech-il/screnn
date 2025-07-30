const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./screens.db');

console.log('🔧 יצירת הרשאות למשתמש saia...');

// User ID for saia (from the logs)
const userId = '0074ed71-21fb-46ad-a622-8e36d7ab73ba';

// Screen IDs (from the logs)
const screenIds = [
  'demo-screen',
  'e91192e9-add3-41f6-b35e-805e41a949bc',
  'de683d9e-9b0c-47db-a0d9-cf249b77a69c'
];

console.log(`משתמש: ${userId}`);
console.log(`מסכים: ${screenIds.length}`);

let completed = 0;

screenIds.forEach((screenId, index) => {
  const permissionId = uuidv4();
  
  db.run(
    'INSERT OR IGNORE INTO user_screen_permissions (id, user_id, screen_id, permission_type, granted_by, granted_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [permissionId, userId, screenId, 'read', userId],
    function(err) {
      if (err) {
        console.error(`❌ שגיאה למסך ${screenId}:`, err);
      } else {
        if (this.changes > 0) {
          console.log(`✅ הרשאה נוצרה למסך ${index + 1}`);
        } else {
          console.log(`ℹ️  הרשאה כבר קיימת למסך ${index + 1}`);
        }
      }
      
      completed++;
      if (completed === screenIds.length) {
        console.log('\n🎉 סיום!');
        process.exit(0);
      }
    }
  );
}); 