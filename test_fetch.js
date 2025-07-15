// Test file to verify the fetch functionality
const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
const data = await response.json();
console.log('Fetched data:', data);

// Test with a different API
const userResponse = await fetch('https://jsonplaceholder.typicode.com/users/1');
const userData = await userResponse.json();
console.log('User data:', userData);

// Test normal console.log statements
console.log('This is a normal string');
console.log('Number:', 42);
console.log('Boolean:', true);
console.log('Array:', [1, 2, 3]);
console.log('Object:', { name: 'John', age: 30 });

// Test error handling
try {
  const errorResponse = await fetch('https://httpstat.us/500');
  const errorData = await errorResponse.json();
  console.log('Error data:', errorData);
} catch (error) {
  console.log('Fetch error:', error.message);
}
