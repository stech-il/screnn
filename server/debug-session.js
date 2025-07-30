const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
axios.defaults.withCredentials = true;

async function debugSession() {
  try {
    console.log('🧪 בדיקת Session עם debug...\n');

    // Step 1: Login
    console.log('1. התחברות...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מוצלחת:', loginResponse.data.user.username);
    console.log('   Session ID:', loginResponse.headers['set-cookie']);

    // Step 2: Check current user with session
    console.log('\n2. בדיקת משתמש נוכחי...');
    try {
      const userResponse = await axios.get(`${BASE_URL}/api/auth/me`);
      console.log('✅ משתמש נוכחי:', userResponse.data.user.username);
    } catch (error) {
      console.log('❌ שגיאה בבדיקת משתמש:', error.response?.data?.error);
      console.log('   Status:', error.response?.status);
    }

    // Step 3: Test with explicit cookie
    console.log('\n3. בדיקה עם cookie מפורש...');
    const cookies = loginResponse.headers['set-cookie'];
    if (cookies) {
      const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('   Cookie header:', cookieHeader);
      
      try {
        const userResponse2 = await axios.get(`${BASE_URL}/api/auth/me`, {
          headers: {
            'Cookie': cookieHeader
          }
        });
        console.log('✅ משתמש נוכחי (עם cookie):', userResponse2.data.user.username);
      } catch (error) {
        console.log('❌ שגיאה עם cookie מפורש:', error.response?.data?.error);
      }
    }

    console.log('\n🎉 בדיקת Session הושלמה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

debugSession(); 