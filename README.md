# 🔍 Simpel-Logger for VS Code

Display `console.log()` output **inline** while coding – instantly, without saving!

> A lightweight developer tool inspired by Quokka.js – open source, no fluff.

---

## ✨ Features

- 🧠 **Live console output** shown inline next to console statements
- 💾 **Works without saving** – reads unsaved (in-memory) code
- 📋 **Rich hover tooltips** with full output and JSON formatting
- 🎛 **Toggle on/off** with commands or keyboard shortcuts
- ⚡ Built for JavaScript & TypeScript with Node.js
- 🌈 **Multiple console methods** supported (log, info, warn, error, debug, table, dir, trace)
- 🎨 **Color-coded output** with unique icons for each console method
- ⚙️ **Configurable settings** for timeout, truncation, and more
- 🚀 **Performance optimized** with debouncing and error handling
- 📦 **Import/require support** – works with Node.js modules and project dependencies
- 🔍 **Executed vs Non-executed** – shows which console logs ran and which didn't

---

## 🚀 Getting Started

### 1. Install from VSIX or Marketplace

*Coming soon to Marketplace!*

Or run from source (see below).

### 2. Use Commands

Open Command Palette (`Ctrl+Shift+P`) and run:
- `Toggle Inline Console Logs` - Enable/disable the extension
- `Clear Inline Console Logs` - Clear all inline output
- `Refresh Inline Console Logs` - Refresh current output

**Keyboard Shortcut:** `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac)

You'll see logs automatically after you:
- Edit code
- Save the file
- Switch editors

---

## 🔍 Examples

### Basic Usage
```js
const user = {
  id: 1,
  name: 'Jane',
  roles: ['admin', 'editor']
};

console.log('User:', user);
```
➡️ Displays inline:
```js
console.log('User:', user); // 💭 => User: { id: 1, name: 'Jane', roles: ['admin', 'editor'] }
```

### Multiple Console Methods
```js
console.log('Regular log');     // 💭 => Regular log
console.info('Info message');   // ℹ️ => Info message
console.warn('Warning!');       // ⚠️ => Warning!
console.error('Error occurred'); // ❌ => Error occurred
console.debug('Debug info');    // 🐛 => Debug info
```

### Complex Objects
```js
const apiResponse = {
  success: true,
  data: { users: [{ id: 1, name: 'Alice' }] },
  message: 'Success'
};

console.log('API:', apiResponse);
```
💡 Hover to see the full formatted JSON output!

---

## ⚙️ Configuration

Customize the extension in VS Code settings:

```json
{
  "simpelLogger.executionTimeout": 3000,
  "simpelLogger.debounceDelay": 500,
  "simpelLogger.truncateLength": 60,
  "simpelLogger.enableOnStartup": false
}
```

### Settings
- `executionTimeout` - Maximum execution time (milliseconds)
- `debounceDelay` - Delay before updating logs (milliseconds)
- `truncateLength` - Maximum inline text length before truncation
- `enableOnStartup` - Enable extension when VS Code starts

---

## 🛠 Requirements
- Node.js must be installed (used to run files internally)
- Works with .js and .ts files in VS Code

---

## 🎯 Performance & Safety

- ⏱️ **Execution timeout** prevents infinite loops
- 🔒 **Safe temp file handling** with unique names
- 🚫 **Debounced execution** reduces CPU usage
- 📊 **Status bar feedback** for errors and timeouts
- 🧹 **Automatic cleanup** of temporary files

