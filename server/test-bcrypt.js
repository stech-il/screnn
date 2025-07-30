const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./screens.db');

console.log('Testing bcrypt...');

// Get the admin user's password hash
db.get('SELECT password_hash FROM users WHERE username = ?', ['admin'], async (err, user) => {
  if (err) {
    console.error('Error getting user:', err);
    return;
  }
  
  if (!user) {
    console.log('Admin user not found');
    return;
  }
  
  console.log('Found admin user with password hash');
  
  try {
    // Test bcrypt comparison
    const isValid = await bcrypt.compare('admin123', user.password_hash);
    console.log('Password verification result:', isValid);
    
    // Test with wrong password
    const isInvalid = await bcrypt.compare('wrongpassword', user.password_hash);
    console.log('Wrong password verification result:', isInvalid);
    
  } catch (error) {
    console.error('Bcrypt error:', error);
  }
  
  db.close();
}); 