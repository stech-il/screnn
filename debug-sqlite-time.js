const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// בדיקת איך SQLite שומר ומחזיר זמנים
const db = new sqlite3.Database(path.join(__dirname, 'server', 'screens.db'));

async function testSQLiteTime() {
    console.log('🔍 בודק איך SQLite מתמודד עם זמנים...');
    
    const testId = 'time-test-' + Date.now();
    const currentTimeISO = new Date().toISOString();
    const currentTimestamp = Date.now();
    
    console.log(`⏰ זמן נוכחי:`);
    console.log(`   ISO: ${currentTimeISO}`);
    console.log(`   Unix timestamp: ${currentTimestamp}`);
    console.log(`   Local: ${new Date().toLocaleString()}`);
    
    // יצירת מסך עם זמן נוכחי
    const insertPromise = new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO screens (id, name, location, last_seen) VALUES (?, ?, ?, ?)',
            [testId, 'מסך בדיקה', 'בדיקה', currentTimeISO],
            function(err) {
                if (err) reject(err);
                else resolve(this);
            }
        );
    });
    
    try {
        await insertPromise;
        console.log('✅ מסך נוצר בהצלחה');
        
        // קריאת הזמן מהדאטבייס
        const selectPromise = new Promise((resolve, reject) => {
            db.get('SELECT id, name, last_seen FROM screens WHERE id = ?', [testId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const result = await selectPromise;
        console.log(`📊 מה שנשמר בדאטבייס:`);
        console.log(`   last_seen: ${result.last_seen}`);
        console.log(`   typeof: ${typeof result.last_seen}`);
        
        // ניסיון לפרסר כ-Date
        const savedTime = new Date(result.last_seen);
        console.log(`🔄 לאחר המרה ל-Date:`);
        console.log(`   Date object: ${savedTime}`);
        console.log(`   ISO: ${savedTime.toISOString()}`);
        console.log(`   Local: ${savedTime.toLocaleString()}`);
        
        // חישוב הפרש
        const now = new Date();
        const diffMs = now - savedTime;
        const diffSeconds = diffMs / 1000;
        
        console.log(`⏱️  הפרש זמן:`);
        console.log(`   MS: ${diffMs}`);
        console.log(`   Seconds: ${diffSeconds}`);
        
        // ניקוי
        db.run('DELETE FROM screens WHERE id = ?', [testId]);
        
    } catch (error) {
        console.error('❌ שגיאה:', error);
    }
    
    db.close();
}

testSQLiteTime();
