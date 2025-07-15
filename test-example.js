// Simpel-Logger Demo - Test different console methods

// Basic console.log
console.log('Hello, World!');

// Variable logging
const user = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    notifications: true
  }
};

console.log('User object:', user);

// Array logging
const numbers = [1, 2, 3, 4, 5];
console.log('Numbers array:', numbers);

// Different console methods
console.info('This is an info message');
console.warn('This is a warning message');
console.error('This is an error message');
console.debug('This is a debug message');

// Complex object
const apiResponse = {
  success: true,
  data: {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ],
    pagination: {
      page: 1,
      total: 50
    }
  },
  message: 'Data fetched successfully'
};

console.log('API Response:', apiResponse);

// Mathematical operations
const result = 42 * 2;
console.log('Calculation result:', result);

// String manipulation
const greeting = 'Hello, ' + user.name + '!';
console.log(greeting);

// Boolean values
const isActive = true;
console.log('User is active:', isActive);

// Null and undefined
console.log('Null value:', null);
console.log('Undefined value:', undefined);

// Function result
function multiply(a, b) {
  return a * b;
}

console.log('Function result:', multiply(5, 3));

// User's example with function containing console.log
var searchIndex = {
    index: function(query) {
        console.log(`Searching for: ${query}`);
        // Here you would implement the search logic, e.g., querying a database or an API.
        return `Results for "${query}"`;
    },
    clear: function() {
        console.log('Search index cleared');
        // Logic to clear the search index can be implemented here.
    }
};

console.log('Search index initialized', searchIndex);

// Call the function to demonstrate the fix
searchIndex.index('hello world');
searchIndex.clear();
