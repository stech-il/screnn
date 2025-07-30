const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('Checking database...');

// Check if users table exists
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error checking tables:', err);
    return;
  }
  
  console.log('Tables in database:', tables.map(t => t.name));
  
  // Check if users table exists
  const hasUsersTable = tables.some(t => t.name === 'users');
  console.log('Has users table:', hasUsersTable);
  
  if (hasUsersTable) {
    // Check users in the table
    db.all('SELECT id, username, role, is_active FROM users', (err, users) => {
      if (err) {
        console.error('Error querying users:', err);
        return;
      }
      
      console.log('Users in database:', users);
      db.close();
    });
  } else {
    console.log('Users table does not exist');
    db.close();
  }
}); 