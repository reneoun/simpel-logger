// Function result
function multiply(a, b) {
  return a * b;
}
console.log('Function result:', multiply(5, 3));

// More function examples
function add(a, b) {
  return a + b;
}
console.log('Addition:', add(10, 20));

function divide(a, b) {
  return a / b;
}
console.log('Division:', divide(100, 4));

// Built-in functions
console.log('Parse int:', parseInt('42'));
console.log('Parse float:', parseFloat('3.14'));
console.log('String conversion:', String(123));
console.log('Number conversion:', Number('456'));

// Mixed expressions
console.log('Mixed:', multiply(2, 3) + add(4, 5));

// Complex function (should show function call format)
function complexFunction(x, y, z) {
  return x + y * z;
}
console.log('Complex:', complexFunction(1, 2, 3));

// Function with string parameters
function greet(name) {
  return 'Hello, ' + name;
}
console.log('Greeting:', greet('World'));
