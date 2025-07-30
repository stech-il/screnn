const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Configure axios to include credentials
axios.defaults.withCredentials = true;

async function testAuthentication() {
  console.log('🧪 בדיקת מערכת האימות...\n');

  try {
    // Test 1: Try to access protected route without authentication
    console.log('1. בדיקת גישה ללא התחברות...');
    try {
      await axios.get(`${BASE_URL}/api/screens`);
      console.log('❌ שגיאה: הצלחתי לגשת ללא התחברות');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ הצלחה: נדרשת התחברות לגישה');
      } else {
        console.log('❌ שגיאה לא צפויה:', error.message);
      }
    }

    // Test 2: Login with correct credentials
    console.log('\n2. בדיקת התחברות עם פרטים נכונים...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      console.log('✅ הצלחה: התחברות מוצלחת');
      console.log('   משתמש:', loginResponse.data.user.username);
      console.log('   תפקיד:', loginResponse.data.user.role);
    } catch (error) {
      console.log('❌ שגיאה בהתחברות:', error.response?.data?.error || error.message);
      return;
    }

    // Test 3: Access protected route after authentication
    console.log('\n3. בדיקת גישה לאחר התחברות...');
    try {
      const screensResponse = await axios.get(`${BASE_URL}/api/screens`);
      console.log('✅ הצלחה: גישה למסכים לאחר התחברות');
      console.log('   מספר מסכים:', screensResponse.data.length);
    } catch (error) {
      console.log('❌ שגיאה בגישה למסכים:', error.response?.data?.error || error.message);
    }

    // Test 4: Check current user
    console.log('\n4. בדיקת פרטי משתמש נוכחי...');
    try {
      const userResponse = await axios.get(`${BASE_URL}/api/auth/me`);
      console.log('✅ הצלחה: פרטי משתמש נוכחי');
      console.log('   שם משתמש:', userResponse.data.user.username);
      console.log('   שם מלא:', userResponse.data.user.full_name);
      console.log('   תפקיד:', userResponse.data.user.role);
    } catch (error) {
      console.log('❌ שגיאה בקבלת פרטי משתמש:', error.response?.data?.error || error.message);
    }

    // Test 5: Logout
    console.log('\n5. בדיקת התנתקות...');
    try {
      await axios.post(`${BASE_URL}/api/auth/logout`);
      console.log('✅ הצלחה: התנתקות מוצלחת');
    } catch (error) {
      console.log('❌ שגיאה בהתנתקות:', error.response?.data?.error || error.message);
    }

    // Test 6: Try to access protected route after logout
    console.log('\n6. בדיקת גישה לאחר התנתקות...');
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

    console.log('\n🎉 בדיקת האימות הושלמה בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה כללית:', error.message);
  }
}

testAuthentication(); 