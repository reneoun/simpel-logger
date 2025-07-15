// Test file with imports to verify the fix
const fs = require('fs');
const path = require('path');

// Test basic console.log
console.log('Testing imports functionality');

// Test with fs module
const packageJsonPath = path.join(__dirname, 'package.json');
console.log('Package.json path:', packageJsonPath);

// Test reading file
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('Package name:', packageJson.name);
  console.log('Package version:', packageJson.version);
} catch (error) {
  console.error('Error reading package.json:', error.message);
}

// Test with function containing console.log
function testFunction() {
  console.log('Function executed successfully');
  return 'Function result';
}

const result = testFunction();
console.log('Function returned:', result);

// Test with object
const testObj = {
  name: 'Test Object',
  type: 'Import Test',
  timestamp: new Date().toISOString()
};

console.log('Test object:', testObj);
