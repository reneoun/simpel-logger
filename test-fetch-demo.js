// Demo: Real fetch requests with static analysis
// This will show actual API responses inline!

// Simple fetch examples
const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
console.log(await response.json());

const userResponse = await fetch('https://jsonplaceholder.typicode.com/users/1');
console.log(await userResponse.json());

// Different API endpoints
const todoResponse = await fetch('https://jsonplaceholder.typicode.com/todos/1');
console.log(await todoResponse.json());

// Text response example
const textResponse = await fetch('https://httpbin.org/ip');
console.log(await textResponse.text());

// Chained fetch examples
fetch('https://jsonplaceholder.typicode.com/posts/2')
  .then(res => res.json())
  .then(data => console.log(data));

// Multiple console.log with different content
console.log('Starting fetch demo...');
console.log('API Response:', await fetch('https://jsonplaceholder.typicode.com/posts/3').then(r => r.json()));
console.log('Demo complete!');
