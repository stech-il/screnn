const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./screens.db');

console.log('Checking users table schema...');

// Get table schema
db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error('Error getting table schema:', err);
    return;
  }
  
  console.log('Users table columns:');
  columns.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Get all data from users table
  db.all('SELECT * FROM users', (err, users) => {
    if (err) {
      console.error('Error querying users:', err);
      return;
    }
    
    console.log('\nUsers data:');
    users.forEach(user => {
      console.log(user);
    });
    
    db.close();
  });
}); 