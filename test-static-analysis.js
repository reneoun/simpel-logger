// Test file for static analysis console logging
const message = "Hello World";
const number = 42;
const isTrue = true;
const nullValue = null;
const arr = [1, 2, 3];
const obj = { name: "John", age: 30 };

// Basic variable console statements - should show resolved values
console.log("This is a simple string");
console.log(message);
console.log(number);
console.log(isTrue);
console.log(nullValue);
console.log("Mixed", message, number);

// Array and object console statements
console.log(arr);
console.log(obj);
console.log(obj.name);
console.log(obj.age);

// Template literals
console.log(`Template: ${message} and ${number}`);
console.log(`Object name: ${obj.name}`);

// Simple arithmetic
const sum = 10 + 5;
const product = 6 * 7;
console.log(sum);
console.log(product);
console.log(10 + 20);
console.log(number + 8);

// Function references
function myFunction() {
  console.log("Inside function");
}

class MyClass {
  constructor() {
    console.log("Inside constructor");
  }
  
  method() {
    console.log("Inside method");
  }
}

// Logging function and class references
console.log(myFunction);
console.log(MyClass);

// Arrow function console statements - should show as "inside callback"
const arrowFunction = () => {
  console.log("Inside arrow function");
};

// Callback console statements - should show as "inside callback"
setTimeout(() => {
  console.log("Inside callback");
}, 1000);

// Complex expressions
console.log("Result:", number * 2 + 10);
console.log([1, 2, message, number]);
console.log({ key: "value", count: number });
