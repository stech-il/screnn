const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Create axios instance with cookie jar
const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testWithCookies() {
  try {
    console.log('🧪 בדיקה עם Cookie Jar...\n');

    // Step 1: Login
    console.log('1. התחברות...');
    const loginResponse = await client.post('/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מוצלחת:', loginResponse.data.user.username);

    // Step 2: Check current user
    console.log('\n2. בדיקת משתמש נוכחי...');
    const userResponse = await client.get('/api/auth/me');
    console.log('✅ משתמש נוכחי:', userResponse.data.user.username);

    // Step 3: Check permissions endpoint
    console.log('\n3. בדיקת גישה לניהול הרשאות...');
    const permissionsResponse = await client.get('/api/admin/permissions');
    console.log('✅ גישה לניהול הרשאות מוצלחת, מספר הרשאות:', permissionsResponse.data.length);

    // Step 4: Check user screens
    console.log('\n4. בדיקת מסכים נגישים...');
    const userScreensResponse = await client.get('/api/user/screens');
    console.log('✅ גישה למסכים נגישים מוצלחת, מספר מסכים:', userScreensResponse.data.length);

    console.log('\n🎉 בדיקה הושלמה בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testWithCookies(); 