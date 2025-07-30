const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
axios.defaults.withCredentials = true;

async function simpleTest() {
  try {
    console.log('🧪 בדיקה פשוטה של מערכת ההרשאות...\n');

    // Step 1: Login as admin
    console.log('1. התחברות כמנהל...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מוצלחת:', loginResponse.data.user.username);

    // Step 2: Check if we can access permissions endpoint
    console.log('\n2. בדיקת גישה לניהול הרשאות...');
    try {
      const permissionsResponse = await axios.get(`${BASE_URL}/api/admin/permissions`);
      console.log('✅ גישה לניהול הרשאות מוצלחת, מספר הרשאות:', permissionsResponse.data.length);
    } catch (error) {
      console.log('❌ שגיאה בגישה לניהול הרשאות:', error.response?.data?.error || error.message);
    }

    // Step 3: Check user screens endpoint
    console.log('\n3. בדיקת מסכים נגישים...');
    try {
      const userScreensResponse = await axios.get(`${BASE_URL}/api/user/screens`);
      console.log('✅ גישה למסכים נגישים מוצלחת, מספר מסכים:', userScreensResponse.data.length);
      
      if (userScreensResponse.data.length > 0) {
        console.log('   מסכים נגישים:');
        userScreensResponse.data.forEach(screen => {
          console.log(`   - ${screen.name} (${screen.permission_type || 'super_admin'})`);
        });
      }
    } catch (error) {
      console.log('❌ שגיאה בגישה למסכים נגישים:', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 בדיקה פשוטה הושלמה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
  }
}

simpleTest(); 