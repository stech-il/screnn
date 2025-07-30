const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
axios.defaults.withCredentials = true;

async function testSession() {
  try {
    console.log('🧪 בדיקת מערכת האימות עם session...\n');

    // Step 1: Login
    console.log('1. התחברות...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מוצלחת:', loginResponse.data.user.username);

    // Step 2: Check current user
    console.log('\n2. בדיקת משתמש נוכחי...');
    const userResponse = await axios.get(`${BASE_URL}/api/auth/me`);
    console.log('✅ משתמש נוכחי:', userResponse.data.user.username);

    // Step 3: Access protected route
    console.log('\n3. גישה למסכים...');
    const screensResponse = await axios.get(`${BASE_URL}/api/screens`);
    console.log('✅ גישה למסכים מוצלחת, מספר מסכים:', screensResponse.data.length);

    // Step 4: Logout
    console.log('\n4. התנתקות...');
    await axios.post(`${BASE_URL}/api/auth/logout`);
    console.log('✅ התנתקות מוצלחת');

    // Step 5: Try to access protected route after logout
    console.log('\n5. בדיקת גישה לאחר התנתקות...');
    try {
      await axios.get(`${BASE_URL}/api/screens`);
      console.log('❌ שגיאה: הצלחתי לגשת לאחר התנתקות');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ הצלחה: נדרשת התחברות לאחר התנתקות');
      } else {
        console.log('❌ שגיאה לא צפויה:', error.message);
      }
    }

    console.log('\n🎉 בדיקת Session הושלמה בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
  }
}

testSession(); 