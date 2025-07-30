const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
axios.defaults.withCredentials = true;

async function testAuth() {
  try {
    console.log('🧪 בדיקה פשוטה של אימות...\n');

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

    // Step 3: Check permissions endpoint
    console.log('\n3. בדיקת גישה לניהול הרשאות...');
    const permissionsResponse = await axios.get(`${BASE_URL}/api/admin/permissions`);
    console.log('✅ גישה לניהול הרשאות מוצלחת, מספר הרשאות:', permissionsResponse.data.length);

    // Step 4: Check user screens
    console.log('\n4. בדיקת מסכים נגישים...');
    const userScreensResponse = await axios.get(`${BASE_URL}/api/user/screens`);
    console.log('✅ גישה למסכים נגישים מוצלחת, מספר מסכים:', userScreensResponse.data.length);

    console.log('\n🎉 בדיקה הושלמה בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testAuth(); 