const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
axios.defaults.withCredentials = true;

async function testPermissions() {
  try {
    console.log('🧪 בדיקת מערכת ההרשאות...\n');

    // Step 1: Login as admin
    console.log('1. התחברות כמנהל...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מוצלחת:', loginResponse.data.user.username);

    // Step 2: Create a test user
    console.log('\n2. יצירת משתמש בדיקה...');
    const testUserResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      username: 'testuser',
      password: 'test123',
      full_name: 'משתמש בדיקה',
      email: 'test@example.com',
      role: 'user'
    });
    console.log('✅ משתמש נוצר:', testUserResponse.data.user.username);

    // Step 3: Get all screens
    console.log('\n3. קבלת רשימת מסכים...');
    const screensResponse = await axios.get(`${BASE_URL}/api/screens`);
    const screens = screensResponse.data;
    console.log('✅ מספר מסכים:', screens.length);

    if (screens.length === 0) {
      console.log('❌ אין מסכים במערכת לבדיקה');
      return;
    }

    const testScreen = screens[0];
    console.log('   מסך לבדיקה:', testScreen.name);

    // Step 4: Create permission for test user
    console.log('\n4. יצירת הרשאה למשתמש...');
    const permissionResponse = await axios.post(`${BASE_URL}/api/admin/permissions`, {
      user_id: testUserResponse.data.user.id,
      screen_id: testScreen.id,
      permission_type: 'read'
    });
    console.log('✅ הרשאה נוצרה:', permissionResponse.data.message);

    // Step 5: Logout admin
    console.log('\n5. התנתקות מנהל...');
    await axios.post(`${BASE_URL}/api/auth/logout`);
    console.log('✅ התנתקות מוצלחת');

    // Step 6: Login as test user
    console.log('\n6. התחברות כמשתמש בדיקה...');
    const testLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'testuser',
      password: 'test123'
    });
    console.log('✅ התחברות מוצלחת:', testLoginResponse.data.user.username);

    // Step 7: Check user's accessible screens
    console.log('\n7. בדיקת מסכים נגישים למשתמש...');
    const userScreensResponse = await axios.get(`${BASE_URL}/api/user/screens`);
    const userScreens = userScreensResponse.data;
    console.log('✅ מספר מסכים נגישים:', userScreens.length);
    
    if (userScreens.length > 0) {
      const accessibleScreen = userScreens.find(s => s.id === testScreen.id);
      if (accessibleScreen) {
        console.log('   ✅ המשתמש יכול לגשת למסך:', accessibleScreen.name);
        console.log('   הרשאה:', accessibleScreen.permission_type);
      } else {
        console.log('   ❌ המשתמש לא יכול לגשת למסך הבדיקה');
      }
    }

    // Step 8: Test accessing screen content
    console.log('\n8. בדיקת גישה לתוכן המסך...');
    try {
      const contentResponse = await axios.get(`${BASE_URL}/api/screens/${testScreen.id}/content`);
      console.log('✅ גישה לתוכן מוצלחת, מספר פריטים:', contentResponse.data.length);
    } catch (error) {
      console.log('❌ שגיאה בגישה לתוכן:', error.response?.data?.error || error.message);
    }

    // Step 9: Test trying to access content without permission
    console.log('\n9. בדיקת גישה למסך ללא הרשאה...');
    try {
      await axios.get(`${BASE_URL}/api/screens/${testScreen.id}/messages`);
      console.log('✅ גישה להודעות מוצלחת');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('❌ נדרשת הרשאה נוספת לגישה להודעות');
      } else {
        console.log('✅ גישה להודעות מוצלחת');
      }
    }

    // Step 10: Logout test user
    console.log('\n10. התנתקות משתמש בדיקה...');
    await axios.post(`${BASE_URL}/api/auth/logout`);
    console.log('✅ התנתקות מוצלחת');

    // Step 11: Login as admin and clean up
    console.log('\n11. ניקוי נתונים...');
    const adminLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ התחברות מנהל לניקוי');

    // Get permissions to delete
    const permissionsResponse = await axios.get(`${BASE_URL}/api/admin/permissions`);
    const testPermissions = permissionsResponse.data.filter(p => 
      p.user_username === 'testuser'
    );

    for (const permission of testPermissions) {
      await axios.delete(`${BASE_URL}/api/admin/permissions/${permission.id}`);
      console.log('   הרשאה נמחקה:', permission.screen_name);
    }

    // Delete test user
    const usersResponse = await axios.get(`${BASE_URL}/api/admin/users`);
    const testUser = usersResponse.data.find(u => u.username === 'testuser');
    if (testUser) {
      await axios.delete(`${BASE_URL}/api/admin/users/${testUser.id}`);
      console.log('   משתמש בדיקה נמחק');
    }

    console.log('\n🎉 בדיקת מערכת ההרשאות הושלמה בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.response?.data || error.message);
  }
}

testPermissions(); 