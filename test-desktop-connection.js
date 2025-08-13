const axios = require('axios');

// בדיקת חיבור מ-Node.js כמו ה-desktop client
async function testDesktopConnection() {
    console.log('🔍 בודק חיבור מ-Node.js לשרת...');
    
    const serverUrl = 'http://localhost:3001';
    
    try {
        // בדיקת health
        console.log('1. בודק /api/health...');
        const healthResponse = await axios.get(`${serverUrl}/api/health`, {
            timeout: 5000,
            headers: {
                'User-Agent': 'DigitalSignage-Desktop/1.0',
                'Accept': 'application/json'
            }
        });
        console.log('✅ Health check OK:', healthResponse.data);
        
        // יצירת מסך חדש
        const testScreenId = 'test-desktop-' + Date.now();
        
        // בדיקת מסך ספציפי
        console.log(`2. בודק מסך ${testScreenId}...`);
        const screenResponse = await axios.get(`${serverUrl}/api/screens/${testScreenId}`, {
            timeout: 5000
        });
        console.log('✅ Screen check OK:', screenResponse.data);
        
        // שליחת heartbeat
        console.log(`3. שולח heartbeat למסך ${testScreenId}...`);
        const heartbeatResponse = await axios.post(`${serverUrl}/api/screens/${testScreenId}/heartbeat`, {}, {
            timeout: 5000,
            headers: {
                'User-Agent': 'DigitalSignage-Desktop/1.0',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Heartbeat OK:', heartbeatResponse.data);
        
        // בדיקת תוכן ציבורי
        console.log(`4. בודק תוכן ציבורי למסך ${testScreenId}...`);
        const contentResponse = await axios.get(`${serverUrl}/api/screens/${testScreenId}/content/public`, {
            timeout: 5000
        });
        console.log('✅ Content check OK:', contentResponse.data.length, 'items');
        
        // בדיקת RSS
        console.log(`5. בודק RSS למסך ${testScreenId}...`);
        const rssResponse = await axios.get(`${serverUrl}/api/screens/${testScreenId}/rss-content`, {
            timeout: 5000
        });
        console.log('✅ RSS check OK:', rssResponse.data.length, 'items');
        
        // בדיקת הודעות
        console.log(`6. בודק הודעות למסך ${testScreenId}...`);
        const messagesResponse = await axios.get(`${serverUrl}/api/screens/${testScreenId}/messages`, {
            timeout: 5000
        });
        console.log('✅ Messages check OK:', messagesResponse.data.length, 'items');
        
        console.log('\n🎉 כל הבדיקות עברו בהצלחה! ה-desktop client אמור לעבוד תקין.');
        
    } catch (error) {
        console.error('\n❌ שגיאה בחיבור:', error.message);
        if (error.response) {
            console.error('📊 פרטי השגיאה:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 פתרון: ודא שהשרת רץ על http://localhost:3001');
        }
    }
}

// הרצת הבדיקה
testDesktopConnection();
