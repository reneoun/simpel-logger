// Test file for async/await and fetch API static analysis
const apiUrl = "https://api.example.com/data";
const userId = 123;

// Basic fetch calls - should predict Promise<Response>
const fetchResult = fetch(apiUrl);
console.log(fetchResult);

// Fetch with dynamic URL
const userFetch = fetch(`https://api.example.com/users/${userId}`);
console.log(userFetch);

// Await fetch calls - should predict resolved Response
const response = await fetch(apiUrl);
console.log(response);

// Await fetch with JSON - should predict JSON data
const data = await fetch(apiUrl).then(r => r.json());
console.log(data);

// Promise static methods
const resolvedPromise = Promise.resolve("Hello World");
const rejectedPromise = Promise.reject(new Error("Something went wrong"));
console.log(resolvedPromise);
console.log(rejectedPromise);

// Promise method chaining
const chainedPromise = fetch(apiUrl).then(r => r.json()).catch(err => err);
console.log(chainedPromise);

// Async function that uses fetch
async function fetchUserData() {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const userData = await response.json();
  console.log("User data:", userData); // This should show as "inside function"
  return userData;
}

// Simple async function
async function simpleAsync() {
  console.log("Inside async function");
  return "async result";
}

// Arrow async function
const asyncArrow = async () => {
  console.log("Inside async arrow function");
  return "arrow result";
};

// Global async/await (in modern environments)
const globalAsync = await simpleAsync();
console.log(globalAsync);

// Promise constructor
const customPromise = new Promise((resolve, reject) => {
  setTimeout(() => resolve("Custom promise result"), 1000);
});
console.log(customPromise);

// Response methods
const response2 = await fetch(apiUrl);
const jsonData = await response2.json();
const textData = await response2.text();
console.log(jsonData);
console.log(textData);
