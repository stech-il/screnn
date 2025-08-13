const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

// בדיקה ישירה של מה שנשמר בDB
async function debugDirectSQL() {
    console.log('🔍 בודק ישירות מה נשמר בDB...');
    
    const serverUrl = 'http://localhost:3001';
    const testScreenId = 'direct-sql-test-' + Date.now();
    
    // פתיחת DB
    const db = new sqlite3.Database(path.join(__dirname, 'server', 'screens.db'));
    
    try {
        // שליחת heartbeat
        console.log(`1. שולח heartbeat למסך ${testScreenId}...`);
        const heartbeatResponse = await axios.post(`${serverUrl}/api/screens/${testScreenId}/heartbeat`, {}, {
            headers: {
                'User-Agent': 'DigitalSignage-Desktop/1.0',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Heartbeat response:', heartbeatResponse.data);
        
        // בדיקה ישירה בDB
        console.log('2. בודק ישירות בDB מה נשמר...');
        const dbResult = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, last_seen, last_seen_timestamp FROM screens WHERE id = ?', [testScreenId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('📊 תוצאה ישירה מהDB:');
        console.log(`   id: ${dbResult.id}`);
        console.log(`   name: ${dbResult.name}`);
        console.log(`   last_seen: ${dbResult.last_seen}`);
        console.log(`   last_seen_timestamp: ${dbResult.last_seen_timestamp}`);
        console.log(`   typeof last_seen: ${typeof dbResult.last_seen}`);
        console.log(`   typeof timestamp: ${typeof dbResult.last_seen_timestamp}`);
        
        // בדיקת הזמן עכשיו
        const now = new Date();
        console.log(`📅 זמן נוכחי: ${now.toISOString()}`);
        
        // ניסיון פרסור
        const savedTime = new Date(dbResult.last_seen);
        console.log(`🔄 אחרי פרסור כ-Date: ${savedTime.toISOString()}`);
        
        const diffMs = now - savedTime;
        const diffSeconds = diffMs / 1000;
        console.log(`⏱️  הפרש זמן: ${diffSeconds} שניות`);
        
        // ניקוי
        db.run('DELETE FROM screens WHERE id = ?', [testScreenId]);
        
    } catch (error) {
        console.error('❌ שגיאה:', error.message);
    } finally {
        db.close();
    }
}

debugDirectSQL();
