const fs = require('fs');
const path = require('path');

console.log('--- Startup diagnostics ---');
console.log('CWD:', process.cwd());
console.log('Node:', process.version);
console.log('ENV PORT:', process.env.PORT);
console.log('ENV DATA_DIR:', process.env.DATA_DIR);

try {
  console.log('Root dir contents:', fs.readdirSync('.'));
} catch (e) {
  console.error('Error reading root dir:', e.message);
}

try {
  console.log('Server dir contents:', fs.readdirSync('server'));
} catch (e) {
  console.error('Server dir not found:', e.message);
}

// Hand off to the actual server
require(path.join(__dirname, 'server', 'index.js'));


