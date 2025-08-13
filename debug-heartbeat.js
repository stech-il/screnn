const axios = require('axios');

// כלי לבדיקת heartbeat מה-desktop client
async function testHeartbeat() {
    console.log('🔍 בודק heartbeat כמו desktop client...');
    
    const serverUrl = 'http://localhost:3001';
    const testScreenId = 'debug-test-' + Date.now();
    
    try {
        console.log(`1. יוצר מסך חדש: ${testScreenId}`);
        
        // יצירת מסך חדש
        const screenResponse = await axios.get(`${serverUrl}/api/screens/${testScreenId}`);
        console.log('✅ מסך נוצר:', screenResponse.data);
        
        // שליחת heartbeat ראשון
        console.log('2. שולח heartbeat ראשון...');
        const heartbeat1 = await axios.post(`${serverUrl}/api/screens/${testScreenId}/heartbeat`, {}, {
            headers: {
                'User-Agent': 'DigitalSignage-Desktop/1.0',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Heartbeat ראשון:', heartbeat1.data);
        
        // בדיקת מסך אחרי heartbeat
        console.log('3. בודק מסך אחרי heartbeat...');
        const updatedScreen = await axios.get(`${serverUrl}/api/screens/${testScreenId}`);
        console.log('✅ מסך מעודכן:', {
            id: updatedScreen.data.id,
            name: updatedScreen.data.name,
            last_seen: updatedScreen.data.last_seen
        });
        
        // חכייה ושליחת heartbeat נוסף
        console.log('4. ממתין 3 שניות ושולח heartbeat נוסף...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const heartbeat2 = await axios.post(`${serverUrl}/api/screens/${testScreenId}/heartbeat`, {}, {
            headers: {
                'User-Agent': 'DigitalSignage-Desktop/1.0',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Heartbeat שני:', heartbeat2.data);
        
        // בדיקה סופית
        console.log('5. בדיקה סופית של המסך...');
        const finalScreen = await axios.get(`${serverUrl}/api/screens/${testScreenId}`);
        console.log('✅ מסך סופי:', {
            id: finalScreen.data.id,
            name: finalScreen.data.name,
            last_seen: finalScreen.data.last_seen
        });
        
        // חישוב הפרש זמן
        const now = new Date();
        const lastSeen = new Date(finalScreen.data.last_seen);
        const diffSeconds = (now - lastSeen) / 1000;
        
        console.log(`\n📊 תוצאות:`);
        console.log(`🕐 זמן נוכחי: ${now.toISOString()}`);
        console.log(`🕑 חיבור אחרון: ${lastSeen.toISOString()}`);
        console.log(`⏱️  הפרש זמן: ${diffSeconds.toFixed(1)} שניות`);
        
        if (diffSeconds < 30) {
            console.log('✅ המסך אמור להיראות כ"מחובר" בפאנל הניהול');
        } else {
            console.log('❌ המסך יראה כ"לא מחובר" בפאנל הניהול');
        }
        
    } catch (error) {
        console.error('\n❌ שגיאה:', error.message);
        if (error.response) {
            console.error('📊 פרטי השגיאה:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
    }
}

// הרצת הבדיקה
testHeartbeat();
