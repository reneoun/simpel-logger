# 🔍 Inline Console Log for VS Code

Display `console.log()` output **inline** while coding – instantly, without saving!

> A lightweight developer tool inspired by Quokka.js – open source, no fluff.

---

## ✨ Features

- 🧠 **Live console output** shown inline next to `console.log(...)` statements
- 💾 **Works without saving** – reads unsaved (in-memory) code
- 📋 **Hover tooltips** with full output for large objects
- 🎛 **Toggle on/off** with a single command
- ⚡ Built for JavaScript & TypeScript with Node.js

---

## 🚀 Getting Started

### 1. Install from VSIX or Marketplace

*Coming soon to Marketplace!*

Or run from source (see below).

### 2. Use the Command Palette

Open Command Palette (`Ctrl+Shift+P`) and run:
```yaml
Toggle Inline Console Logs
```

You’ll see logs automatically after you:

- Edit code
- Save the file
- Switch editors

---

## 🔍 Example

```ts
const user = {
  id: 1,
  name: 'Jane',
  roles: ['admin', 'editor']
};

console.log('User:', user);
```
➡️ Displays inline:
```ts
console.log('User:', user); //💭 => User: { id: 1, name: 'Jane', roles: ['admin', 'editor'] }
```

💡 Hover to see the full output, even for multiline objects.


## 🛠 Requirements
- Node.js must be installed (used to run files internally)
- Works with .js and .ts files in VS Code

