// Test file for client-side code that might have issues

// This would normally fail in Node.js but should be handled gracefully
console.log('Starting client-side test');

// Mock importing a client-side module (this would fail in Node.js)
// import { someFunction } from './client-module.js';

// Simulate trying to use browser APIs
try {
  console.log('Window location:', window.location.href);
} catch (error) {
  console.log('Window not available:', error.message);
}

// Test DOM operations
try {
  const element = document.querySelector('.test');
  console.log('Element found:', element);
} catch (error) {
  console.log('Document not available:', error.message);
}

// Test fetch API
try {
  fetch('https://api.example.com/data')
    .then(response => response.json())
    .then(data => console.log('API data:', data));
} catch (error) {
  console.log('Fetch not available:', error.message);
}

// This should work fine
const testData = {
  name: 'Client Test',
  type: 'Browser Code',
  timestamp: new Date().toISOString()
};

console.log('Test data:', testData);

// Function with console.log
function clientFunction() {
  console.log('Client function executed');
  return 'Success';
}

const result = clientFunction();
console.log('Function result:', result);
