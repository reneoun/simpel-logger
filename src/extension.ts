import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

let enabled = false;
let decorationType: vscode.TextEditorDecorationType | null = null;
let executionTimeout: NodeJS.Timeout | null = null;

// Different decoration types for different states
let executedDecorationType: vscode.TextEditorDecorationType | null = null;
let nonExecutedDecorationType: vscode.TextEditorDecorationType | null = null;

// Decoration manager to handle all decorations
const decorationManager = {
  predictedDecorations: [] as vscode.DecorationOptions[],
  nonExecutedDecorations: [] as vscode.DecorationOptions[],
  
  addPredictedDecoration(decoration: vscode.DecorationOptions) {
    this.predictedDecorations.push(decoration);
  },
  
  addNonExecutedDecoration(decoration: vscode.DecorationOptions) {
    this.nonExecutedDecorations.push(decoration);
  },
  
  updatePredictedDecoration(range: vscode.Range, decoration: vscode.DecorationOptions) {
    // Find and update existing decoration or add new one
    const existingIndex = this.predictedDecorations.findIndex(d => 
      d.range.start.line === range.start.line && d.range.start.character === range.start.character
    );
    
    if (existingIndex !== -1) {
      this.predictedDecorations[existingIndex] = decoration;
    } else {
      this.predictedDecorations.push(decoration);
    }
  },
  
  applyDecorations(editor: vscode.TextEditor) {
    if (executedDecorationType) {
      editor.setDecorations(executedDecorationType, this.predictedDecorations);
    }
    if (nonExecutedDecorationType) {
      editor.setDecorations(nonExecutedDecorationType, this.nonExecutedDecorations);
    }
  },
  
  clear() {
    this.predictedDecorations = [];
    this.nonExecutedDecorations = [];
  }
};

// Configuration - now reads from VS Code settings
function getConfig() {
  const config = vscode.workspace.getConfiguration('simpelLogger');
  return {
    EXECUTION_TIMEOUT: config.get('executionTimeout', 3000),
    MAX_OUTPUT_LENGTH: 1000,
    TRUNCATE_LENGTH: config.get('truncateLength', 60),
    DEBOUNCE_DELAY: config.get('debounceDelay', 500)
  };
}

export function activate(context: vscode.ExtensionContext) {
  // Check if extension should be enabled on startup
  const config = getConfig();
  const shouldEnableOnStartup = vscode.workspace.getConfiguration('simpelLogger').get('enableOnStartup', false);
  if (shouldEnableOnStartup) {
    enabled = true;
    if (vscode.window.activeTextEditor) {
      updateDecorations(vscode.window.activeTextEditor.document);
    }
  }

  // Toggle command
  const toggleCommand = vscode.commands.registerCommand('inlineConsole.toggle', () => {
    enabled = !enabled;
    vscode.window.showInformationMessage(`Inline Console Logs ${enabled ? 'Enabled' : 'Disabled'}`);

    if (enabled && vscode.window.activeTextEditor) {
      updateDecorations(vscode.window.activeTextEditor.document);
    } else {
      clearDecorations();
    }
  });

  // Clear command
  const clearCommand = vscode.commands.registerCommand('inlineConsole.clear', () => {
    clearDecorations();
    vscode.window.showInformationMessage('Inline Console Logs cleared');
  });

  // Refresh command
  const refreshCommand = vscode.commands.registerCommand('inlineConsole.refresh', () => {
    if (enabled && vscode.window.activeTextEditor) {
      updateDecorations(vscode.window.activeTextEditor.document);
      vscode.window.showInformationMessage('Inline Console Logs refreshed');
    } else {
      vscode.window.showInformationMessage('Inline Console Logs are disabled');
    }
  });

  context.subscriptions.push(toggleCommand, clearCommand, refreshCommand);

  // Respond to saves, edits, or switching editors
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (enabled) updateDecorations(doc);
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      if (enabled) updateDecorations(event.document);
    }),

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (enabled && editor) updateDecorations(editor.document);
    })
  );
}


// Extended console methods support
const consoles = [
  'console.log', 'console.debug', 'console.info', 'console.warn', 
  'console.error', 'console.table', 'console.dir', 'console.trace'
];

// Fetch cache and configuration
interface FetchCacheEntry {
  data: any;
  timestamp: number;
  url: string;
}

const fetchCache = new Map<string, FetchCacheEntry>();
const FETCH_CONFIG = {
  timeout: 3000,
  maxResponseSize: 1024 * 50, // 50KB limit
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100, // Maximum number of cached responses
};

// Helper function to make safe HTTP requests
function makeHttpRequest(requestUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check cache first
    if (fetchCache.has(requestUrl)) {
      const cached = fetchCache.get(requestUrl)!;
      if (Date.now() - cached.timestamp < FETCH_CONFIG.cacheExpiry) {
        resolve(cached.data);
        return;
      } else {
        // Remove expired cache entry
        fetchCache.delete(requestUrl);
      }
    }
    
    // Only allow GET requests to safe URLs
    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
      reject(new Error('Only HTTP/HTTPS URLs are allowed'));
      return;
    }
    
    const parsedUrl = new URL(requestUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, FETCH_CONFIG.timeout);
    
    const req = client.get(requestUrl, { 
      headers: {
        'User-Agent': 'VS Code Extension - Simpel Logger',
        'Accept': 'application/json, text/plain, */*',
      },
      timeout: FETCH_CONFIG.timeout
    }, (res) => {
      clearTimeout(timeout);
      
      let data = '';
      let bytesReceived = 0;
      
      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived > FETCH_CONFIG.maxResponseSize) {
          req.destroy();
          reject(new Error('Response too large'));
          return;
        }
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          let responseData: any;
          const contentType = res.headers['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            responseData = JSON.parse(data);
          } else {
            responseData = data;
          }
          
          // Cache the response
          if (fetchCache.size >= FETCH_CONFIG.maxCacheSize) {
            // Remove oldest entry
            const oldestKey = Array.from(fetchCache.keys())[0];
            fetchCache.delete(oldestKey);
          }
          
          fetchCache.set(requestUrl, {
            data: responseData,
            timestamp: Date.now(),
            url: requestUrl
          });
          
          resolve(responseData);
        } catch (error) {
          reject(error);
        }
      });
      
      res.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Debounced update function to improve performance
function updateDecorations(doc: vscode.TextDocument) {
  if (doc.languageId !== 'javascript' && doc.languageId !== 'typescript') return;

  const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
  if (!editor) return;

  // Clear existing timeout
  if (executionTimeout) {
    clearTimeout(executionTimeout);
  }

  // Debounce execution to improve performance
  const config = getConfig();
  executionTimeout = setTimeout(() => {
    executeAndDecorate(doc, editor);
  }, config.DEBOUNCE_DELAY);
}

// Static analysis function to predict console.log outputs
function executeAndDecorate(doc: vscode.TextDocument, editor: vscode.TextEditor) {
  const config = getConfig();
  const code = doc.getText();
  
  // Skip if code is empty or too large
  if (!code.trim() || code.length > config.MAX_OUTPUT_LENGTH * 50) {
    return;
  }
  
  try {
    // Use static analysis to predict console.log outputs
    const predictions = analyzeCodeStatically(code);
    createStaticDecorations(code, predictions, editor);
    
    // Optional: Also try hybrid approach for simple cases
    if (predictions.canExecuteSimply) {
      trySimpleExecution(doc, editor, predictions);
    }
    
  } catch (error: any) {
    console.log('Static analysis error:', error.message);
    vscode.window.setStatusBarMessage('❌ Simpel-Logger: Static analysis failed', 3000);
    showNonExecutedDecorations(code, editor);
  }
}

// Function to show non-executed decorations when execution fails
function showNonExecutedDecorations(code: string, editor: vscode.TextEditor) {
  const lines = code.split('\n');
  const nonExecutedDecorations: vscode.DecorationOptions[] = [];
  
  lines.forEach((line, i) => {
    const consoleMatch = consoles.find(c => line.includes(c));
    if (consoleMatch) {
      const icon = getConsoleIcon(consoleMatch);
      
      nonExecutedDecorations.push({
        range: new vscode.Range(i, line.length, i, line.length),
        renderOptions: {
          after: {
            contentText: `${icon} (execution failed)`,
            color: '#ff6b6b', // Red color for failed execution
            fontStyle: 'italic',
            margin: '0 0 0 1em'
          }
        },
        hoverMessage: new vscode.MarkdownString(`**${consoleMatch}** - Execution failed (possibly client-side code or missing dependencies)`)
      });
    }
  });
  
  // Apply decorations
  if (nonExecutedDecorationType) nonExecutedDecorationType.dispose();
  if (executedDecorationType) executedDecorationType.dispose();
  
  nonExecutedDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(nonExecutedDecorationType, nonExecutedDecorations);
}

// Analyze code statically to predict console.log outputs
function analyzeCodeStatically(code: string) {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });
  const consoleStatements: { 
    line: number; 
    method: string; 
    args: string[];
    context: 'global' | 'function' | 'class' | 'callback';
    predictedOutput?: string;
    fetchRequests?: Array<{ url: string; type: string; argIndex: number }>;
  }[] = [];
  let canExecuteSimply = true;
  let currentContext: 'global' | 'function' | 'class' | 'callback' = 'global';
  const variables = new Map<string, any>();
  const functions = new Map<string, string>();
  const classes = new Map<string, string>();
  const objects = new Map<string, any>();

  // Helper function to evaluate expressions
  function evaluateExpression(node: any): any {
    if (t.isStringLiteral(node)) return node.value;
    if (t.isNumericLiteral(node)) return node.value;
    if (t.isBooleanLiteral(node)) return node.value;
    if (t.isNullLiteral(node)) return null;
    if (t.isUnaryExpression(node) && node.operator === 'void' && t.isNumericLiteral(node.argument) && node.argument.value === 0) return undefined;
    
    if (t.isIdentifier(node)) {
      if (variables.has(node.name)) {
        return variables.get(node.name);
      }
      if (functions.has(node.name)) {
        return `[Function: ${node.name}]`;
      }
      if (classes.has(node.name)) {
        return `[Class: ${node.name}]`;
      }
      return node.name; // Return identifier name if not found
    }
    
    if (t.isArrayExpression(node)) {
      const elements = node.elements.map((el: any) => {
        if (el === null) return null;
        return evaluateExpression(el);
      });
      return `[${elements.join(', ')}]`;
    }
    
    if (t.isObjectExpression(node)) {
      const props = node.properties.map((prop: any) => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          const value = evaluateExpression(prop.value);
          return `${prop.key.name}: ${typeof value === 'string' && !value.startsWith('[') ? `"${value}"` : value}`;
        }
        return '[complex property]';
      });
      return `{ ${props.join(', ')} }`;
    }
    
    if (t.isMemberExpression(node)) {
      const objectName = t.isIdentifier(node.object) ? node.object.name : '[complex object]';
      const propertyName = t.isIdentifier(node.property) ? node.property.name : '[computed property]';
      
      if (objects.has(objectName)) {
        const obj = objects.get(objectName);
        if (obj && typeof obj === 'object' && propertyName in obj) {
          return obj[propertyName];
        }
      }
      
      return `${objectName}.${propertyName}`;
    }
    
    if (t.isBinaryExpression(node)) {
      const left = evaluateExpression(node.left);
      const right = evaluateExpression(node.right);
      
      // Handle simple binary operations
      if (node.operator === '+') {
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        return `${left} + ${right}`;
      }
      if (node.operator === '-' && typeof left === 'number' && typeof right === 'number') {
        return left - right;
      }
      if (node.operator === '*' && typeof left === 'number' && typeof right === 'number') {
        return left * right;
      }
      if (node.operator === '/' && typeof left === 'number' && typeof right === 'number') {
        return left / right;
      }
      
      return `${left} ${node.operator} ${right}`;
    }
    
    if (t.isTemplateLiteral(node)) {
      let result = '';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked;
        if (i < node.expressions.length) {
          const expr = evaluateExpression(node.expressions[i]);
          result += expr;
        }
      }
      return result;
    }
    
    // Handle await expressions
    if (t.isAwaitExpression(node)) {
      const argument = evaluateExpression(node.argument);
      
      // Special handling for fetch calls
      if (t.isCallExpression(node.argument) && 
          t.isIdentifier(node.argument.callee) && 
          node.argument.callee.name === 'fetch') {
        const url = node.argument.arguments[0] ? evaluateExpression(node.argument.arguments[0]) : 'unknown';
        return `Promise<Response> { url: "${url}", status: 200, ok: true, ... }`;
      }
      
      // Handle awaited fetch results (json(), text(), etc.)
      if (typeof argument === 'object' && argument !== null && argument.fetchUrl) {
        return argument; // Pass through the fetch object for later processing
      }
      
      // Generic promise handling
      if (typeof argument === 'string' && argument.startsWith('Promise<')) {
        return argument.replace('Promise<', '').replace('>', '');
      }
      
      return `[awaited ${argument}]`;
    }
    
    // Handle function calls
    if (t.isCallExpression(node)) {
      if (t.isIdentifier(node.callee)) {
        // Handle fetch calls
        if (node.callee.name === 'fetch') {
          const url = node.arguments[0] ? evaluateExpression(node.arguments[0]) : 'unknown';
          return `Promise<Response> { url: "${url}" }`;
        }
        
        // Handle Promise.resolve/reject
        if (node.callee.name === 'Promise') {
          return 'Promise<unknown>';
        }
        
        // Handle simple function calls with known functions
        if (functions.has(node.callee.name)) {
          const args = node.arguments.map((arg: any) => evaluateExpression(arg));
          
          // Try to evaluate simple mathematical functions
          if (node.callee.name === 'multiply' && args.length === 2) {
            const [a, b] = args;
            if (typeof a === 'number' && typeof b === 'number') {
              return a * b;
            }
          }
          
          if (node.callee.name === 'add' && args.length === 2) {
            const [a, b] = args;
            if (typeof a === 'number' && typeof b === 'number') {
              return a + b;
            }
          }
          
          if (node.callee.name === 'subtract' && args.length === 2) {
            const [a, b] = args;
            if (typeof a === 'number' && typeof b === 'number') {
              return a - b;
            }
          }
          
          if (node.callee.name === 'divide' && args.length === 2) {
            const [a, b] = args;
            if (typeof a === 'number' && typeof b === 'number' && b !== 0) {
              return a / b;
            }
          }
          
          // For other functions, show the call with evaluated arguments
          return `${node.callee.name}(${args.join(', ')})`;
        }
        
        // Handle built-in functions
        if (node.callee.name === 'parseInt' && node.arguments.length >= 1) {
          const arg = evaluateExpression(node.arguments[0]);
          if (typeof arg === 'string' || typeof arg === 'number') {
            const result = parseInt(String(arg));
            if (!isNaN(result)) {
              return result;
            }
          }
        }
        
        if (node.callee.name === 'parseFloat' && node.arguments.length >= 1) {
          const arg = evaluateExpression(node.arguments[0]);
          if (typeof arg === 'string' || typeof arg === 'number') {
            const result = parseFloat(String(arg));
            if (!isNaN(result)) {
              return result;
            }
          }
        }
        
        if (node.callee.name === 'String' && node.arguments.length >= 1) {
          const arg = evaluateExpression(node.arguments[0]);
          return String(arg);
        }
        
        if (node.callee.name === 'Number' && node.arguments.length >= 1) {
          const arg = evaluateExpression(node.arguments[0]);
          if (typeof arg === 'string' || typeof arg === 'number') {
            const result = Number(arg);
            if (!isNaN(result)) {
              return result;
            }
          }
        }
        
        // Generic function call with evaluated arguments
        const args = node.arguments.map((arg: any) => evaluateExpression(arg));
        return `${node.callee.name}(${args.join(', ')})`;
      }
      
      // Handle Promise methods
      if (t.isMemberExpression(node.callee) && 
          t.isIdentifier(node.callee.object) && 
          node.callee.object.name === 'Promise') {
        if (t.isIdentifier(node.callee.property)) {
          const method = node.callee.property.name;
          if (method === 'resolve') {
            const value = node.arguments[0] ? evaluateExpression(node.arguments[0]) : 'undefined';
            return `Promise<resolved: ${value}>`;
          }
          if (method === 'reject') {
            const error = node.arguments[0] ? evaluateExpression(node.arguments[0]) : 'Error';
            return `Promise<rejected: ${error}>`;
          }
        }
      }
      
      // Handle method calls that might return promises
      if (t.isMemberExpression(node.callee)) {
        const obj = evaluateExpression(node.callee.object);
        const method = t.isIdentifier(node.callee.property) ? node.callee.property.name : 'unknown';
        
        // Common async methods with actual fetch support
        if (method === 'json' && typeof obj === 'string' && obj.includes('Response')) {
          // Try to extract URL from the response object string
          const urlMatch = obj.match(/url: "([^"]+)"/);
          if (urlMatch) {
            const fetchUrl = urlMatch[1];
            if (fetchUrl && fetchUrl !== 'unknown' && (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://'))) {
              // Return a special marker that will be resolved asynchronously
              return { fetchUrl, type: 'json', placeholder: '🔄 Fetching...' };
            }
          }
          return 'Promise<JSON data>';
        }
        if (method === 'text' && typeof obj === 'string' && obj.includes('Response')) {
          const urlMatch = obj.match(/url: "([^"]+)"/);
          if (urlMatch) {
            const fetchUrl = urlMatch[1];
            if (fetchUrl && fetchUrl !== 'unknown' && (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://'))) {
              return { fetchUrl, type: 'text', placeholder: '🔄 Fetching...' };
            }
          }
          return 'Promise<string>';
        }
        if (method === 'then' || method === 'catch' || method === 'finally') {
          return 'Promise<unknown>';
        }
      }
    }
    
    // Handle async function expressions
    if (t.isArrowFunctionExpression(node) && node.async) {
      return '[async function]';
    }
    
    return '[complex expression]';
  }

  traverse(ast, {
    CallExpression(path: any) {
      const callee = path.get('callee');
      if (
        callee.isMemberExpression() &&
        callee.get('object').isIdentifier({ name: 'console' }) &&
        t.isIdentifier(callee.node.property) &&
        consoles.includes(`console.${callee.node.property.name}`)
      ) {
        const line = path.node.loc?.start.line || 0;
        const args = path.node.arguments.map((arg: any) => {
          return evaluateExpression(arg);
        });
        
        // Try to predict output for simple cases
        let predictedOutput = '';
        let hasFetchRequest = false;
        const fetchRequests: Array<{ url: string; type: string; argIndex: number }> = [];
        
        if (currentContext === 'global') {
          const processedArgs = args.map((arg: any, index: number) => {
            if (typeof arg === 'object' && arg !== null && arg.fetchUrl) {
              hasFetchRequest = true;
              fetchRequests.push({ url: arg.fetchUrl, type: arg.type, argIndex: index });
              return arg.placeholder;
            }
            if (typeof arg === 'string' && !arg.startsWith('[')) {
              return arg;
            }
            return String(arg);
          });
          
          predictedOutput = processedArgs.join(' ');
        }
        
        consoleStatements.push({ 
          line, 
          method: callee.node.property.name, 
          args: args.map(String),
          context: currentContext,
          predictedOutput,
          fetchRequests: hasFetchRequest ? fetchRequests : []
        });
      }
    },
    
    // Track variable assignments for better prediction
    VariableDeclarator(path: any) {
      if (t.isIdentifier(path.node.id) && path.node.init) {
        const value = evaluateExpression(path.node.init);
        variables.set(path.node.id.name, value);
        
        // Also track objects for property access
        if (t.isObjectExpression(path.node.init)) {
          const obj: any = {};
          path.node.init.properties.forEach((prop: any) => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              obj[prop.key.name] = evaluateExpression(prop.value);
            }
          });
          objects.set(path.node.id.name, obj);
        }
      }
    },
    
    // Track function declarations
    FunctionDeclaration(path: any) {
      if (t.isIdentifier(path.node.id)) {
        const params = path.node.params.map((param: any) => {
          return t.isIdentifier(param) ? param.name : '[complex param]';
        }).join(', ');
        functions.set(path.node.id.name, `function ${path.node.id.name}(${params})`);
      }
      
      currentContext = 'function';
      if (path.node.params.length > 0) canExecuteSimply = false;
    },
    
    // Track class declarations
    ClassDeclaration(path: any) {
      if (t.isIdentifier(path.node.id)) {
        classes.set(path.node.id.name, `class ${path.node.id.name}`);
      }
    },
    
    ClassMethod(path: any) {
      currentContext = 'class';
      if (path.node.params.length > 0) canExecuteSimply = false;
    },
    
    ArrowFunctionExpression(path: any) {
      currentContext = 'callback';
      if (path.node.params.length > 0) canExecuteSimply = false;
    },
    
    // Reset context when exiting
    'FunctionDeclaration|ClassMethod|ArrowFunctionExpression': {
      exit() {
        currentContext = 'global';
      }
    }
  });

  return { consoleStatements, canExecuteSimply, variables, functions, classes, objects };
}

// Create decorations based on static analysis with async fetch support
function createStaticDecorations(
  code: string,
  analysis: { 
    consoleStatements: { 
      line: number; 
      method: string; 
      args: string[];
      context: 'global' | 'function' | 'class' | 'callback';
      predictedOutput?: string;
      fetchRequests?: Array<{ url: string; type: string; argIndex: number }>;
    }[]
  },
  editor: vscode.TextEditor
) {
  const config = getConfig();
  const predictedDecorations: vscode.DecorationOptions[] = [];
  const nonExecutedDecorations: vscode.DecorationOptions[] = [];
  const fetchPromises: Promise<void>[] = [];

  analysis.consoleStatements.forEach(statement => {
    const range = new vscode.Range(
      statement.line - 1, 
      code.split('\n')[statement.line - 1]?.length || 0, 
      statement.line - 1, 
      code.split('\n')[statement.line - 1]?.length || 0
    );
    
    const icon = getConsoleIcon(`console.${statement.method}`);
    const color = getConsoleColor(`console.${statement.method}`);
    
    if (statement.context === 'global' && statement.predictedOutput) {
      // Check if this statement contains fetch requests
      const fetchUrls = (statement as any).fetchRequests || [];
      
      if (fetchUrls.length > 0) {
        // Show loading state first
        const loadingOutput = statement.predictedOutput.replace(/🔄 Fetching\.\.\./g, '🔄 Fetching...');
        const short = loadingOutput.length > config.TRUNCATE_LENGTH
          ? loadingOutput.slice(0, config.TRUNCATE_LENGTH - 3) + '...'
          : loadingOutput;
        
        predictedDecorations.push({
          range,
          renderOptions: {
            after: {
              contentText: `${icon} => ${short}`,
              color: color,
              fontStyle: 'italic',
              margin: '0 0 0 1em'
            }
          },
          hoverMessage: new vscode.MarkdownString(
            `**console.${statement.method}** (loading): ${loadingOutput}`
          )
        });
        
        // Start fetch requests and update decorations when complete
        fetchUrls.forEach(({ url, type, argIndex }: { url: string; type: string; argIndex: number }) => {
          const fetchPromise = makeHttpRequest(url)
            .then((data) => {
              let processedData;
              if (type === 'json') {
                processedData = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
              } else {
                processedData = String(data);
              }
              
              // Update the predicted output by replacing the placeholder
              const newArgs = [...statement.args];
              newArgs[argIndex] = processedData;
              const newOutput = newArgs.join(' ');
              
              // Update decoration with real data
              updateDecorationWithFetchResult(editor, range, icon, color, newOutput, statement.method);
            })
            .catch((error) => {
              // Update decoration with error
              const newArgs = [...statement.args];
              newArgs[argIndex] = `❌ Fetch error: ${error.message}`;
              const newOutput = newArgs.join(' ');
              
              updateDecorationWithFetchResult(editor, range, icon, '#ff6b6b', newOutput, statement.method);
            });
          
          fetchPromises.push(fetchPromise);
        });
      } else {
        // Show regular predicted output
        const short = statement.predictedOutput.length > config.TRUNCATE_LENGTH
          ? statement.predictedOutput.slice(0, config.TRUNCATE_LENGTH - 3) + '...'
          : statement.predictedOutput;
        
        predictedDecorations.push({
          range,
          renderOptions: {
            after: {
              contentText: `${icon} => ${short}`,
              color: color,
              fontStyle: 'italic',
              margin: '0 0 0 1em'
            }
          },
          hoverMessage: new vscode.MarkdownString(
            `**console.${statement.method}** (predicted): ${statement.predictedOutput}`
          )
        });
      }
    } else {
      // Show context-based status for non-global console statements
      const contextMessages: Record<string, string> = {
        'function': 'inside function',
        'class': 'inside class method',
        'callback': 'inside callback',
        'global': 'global context'
      };
      const contextMessage = contextMessages[statement.context] || 'not executed';
      
      nonExecutedDecorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `${icon} (${contextMessage})`,
            color: '#888888',
            fontStyle: 'italic',
            margin: '0 0 0 1em'
          }
        },
        hoverMessage: new vscode.MarkdownString(
          `**console.${statement.method}** - ${contextMessage}, requires runtime execution`
        )
      });
    }
  });

  // Dispose of any existing decorations first
  if (executedDecorationType) executedDecorationType.dispose();
  if (nonExecutedDecorationType) nonExecutedDecorationType.dispose();

  // Clear existing decorations
  decorationManager.clear();

  // Create new decoration types
  executedDecorationType = vscode.window.createTextEditorDecorationType({});
  nonExecutedDecorationType = vscode.window.createTextEditorDecorationType({});

  // Add decorations to manager
  predictedDecorations.forEach(decoration => decorationManager.addPredictedDecoration(decoration));
  nonExecutedDecorations.forEach(decoration => decorationManager.addNonExecutedDecoration(decoration));

  // Apply all decorations through decoration manager
  decorationManager.applyDecorations(editor);
}

// Extract fetch URLs from console arguments
function extractFetchUrls(args: string[]): Array<{ url: string; type: string; argIndex: number }> {
  const fetchUrls: Array<{ url: string; type: string; argIndex: number }> = [];
  
  args.forEach((arg, index) => {
    if (typeof arg === 'string' && arg.includes('🔄 Fetching...')) {
      // This is a placeholder from a fetch request
      const urlMatch = arg.match(/🔄 Fetching\.\.\./); // We need to extract the URL from the original arg
      // For now, we'll need to implement proper URL extraction
      // This is a simplified version - in practice, we'd need to store the URL data
    }
  });
  
  return fetchUrls;
}

// Update decoration with fetch result
function updateDecorationWithFetchResult(
  editor: vscode.TextEditor,
  range: vscode.Range,
  icon: string,
  color: string,
  output: string,
  method: string
) {
  const config = getConfig();
  const short = output.length > config.TRUNCATE_LENGTH
    ? output.slice(0, config.TRUNCATE_LENGTH - 3) + '...'
    : output;
  
  const decoration: vscode.DecorationOptions = {
    range,
    renderOptions: {
      after: {
        contentText: `${icon} => ${short}`,
        color: color,
        fontStyle: 'italic',
        margin: '0 0 0 1em'
      }
    },
    hoverMessage: new vscode.MarkdownString(
      `**console.${method}** (fetched): ${output}`
    )
  };
  
  // Update decoration in the manager and reapply all decorations
  decorationManager.updatePredictedDecoration(range, decoration);
  decorationManager.applyDecorations(editor);
}

// Simple execution for cases where static analysis indicates it's safe
function trySimpleExecution(
  doc: vscode.TextDocument,
  editor: vscode.TextEditor,
  predictions: any
) {
  // Only execute if we have global console statements with predictions
  const globalStatements = predictions.consoleStatements.filter(
    (stmt: any) => stmt.context === 'global' && stmt.predictedOutput
  );
  
  if (globalStatements.length === 0) {
    return;
  }
  
  // For now, just rely on static predictions
  // In the future, we could try minimal execution for very simple cases
  console.log('Simple execution would be attempted for:', globalStatements.length, 'statements');
}

// Note: This function is kept for backward compatibility but may be removed in future versions
// The new static analysis approach is preferred



// Clean up code to remove problematic characters
function cleanUpCode(code: string): string {
  let cleanedCode = code
    // Remove null characters and other control characters
    .replace(/\x00/g, '') // Remove null characters
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
    // Ensure proper line endings
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n') // Convert remaining \r to \n
    // Clean up any weird Unicode characters that might cause issues
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Remove zero-width characters and other invisible characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Ensure the string is properly normalized
    .normalize('NFC')
    // Remove any remaining problematic whitespace
    .replace(/\u00A0/g, ' ') // Replace non-breaking space with regular space
    .replace(/\s+$/gm, '') // Remove trailing whitespace from each line
    .replace(/^\s*$/gm, '') // Remove empty lines with only whitespace
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with at most 2
  
  // If the code starts with problematic characters, try to fix
  if (cleanedCode.match(/^[^\w\s\(\)\{\}\[\]]/)) {
    cleanedCode = cleanedCode.replace(/^[^\w\s\(\)\{\}\[\]]+/, '');
  }
  
  return cleanedCode;
}

// Safe cleanup function
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Silently ignore cleanup errors
  }
}

// Combined decoration function that handles both executed and non-executed console logs
function createCombinedDecorations(
  code: string, 
  stdout: string, 
  stderr: string, 
  editor: vscode.TextEditor
) {
  const config = getConfig();
  const lines = code.split('\n');
  const allOutput = stdout + (stderr ? '\n' + stderr : '');
  const outputLines = allOutput.trim().split('\n').filter(line => line.trim());

  // Parse output with line tracking
  const lineOutputMap = new Map<number, string[]>();
  let currentLineNumber: number | null = null;
  let currentOutput = '';
  let inMultiline = false;

  outputLines.forEach(line => {
    if (/^\s*$/.test(line)) return;

    // Check if this is a line marker
    const lineMarkerMatch = line.match(/^\[SIMPEL_LOGGER_LINE_(\d+)\]$/);
    if (lineMarkerMatch) {
      // Save previous output if any
      if (currentLineNumber !== null && currentOutput.trim()) {
        if (!lineOutputMap.has(currentLineNumber)) {
          lineOutputMap.set(currentLineNumber, []);
        }
        lineOutputMap.get(currentLineNumber)!.push(currentOutput.trim());
      }
      
      // Start tracking new line
      currentLineNumber = parseInt(lineMarkerMatch[1]);
      currentOutput = '';
      inMultiline = false;
      return;
    }

    // Accumulate output for current line
    if (currentLineNumber !== null) {
      if (!inMultiline && !line.startsWith(' ') && !line.startsWith('\t')) {
        if (currentOutput.trim()) {
          // Save previous output
          if (!lineOutputMap.has(currentLineNumber)) {
            lineOutputMap.set(currentLineNumber, []);
          }
          lineOutputMap.get(currentLineNumber)!.push(currentOutput.trim());
        }
        currentOutput = line;
        inMultiline = false;
      } else {
        currentOutput += (currentOutput ? '\n' : '') + line;
        inMultiline = true;
      }
    }
  });

  // Save final output
  if (currentLineNumber !== null && currentOutput.trim()) {
    if (!lineOutputMap.has(currentLineNumber)) {
      lineOutputMap.set(currentLineNumber, []);
    }
    lineOutputMap.get(currentLineNumber)!.push(currentOutput.trim());
  }

  const executedDecorations: vscode.DecorationOptions[] = [];
  const nonExecutedDecorations: vscode.DecorationOptions[] = [];

  // Create decorations for each line with console statements
  lines.forEach((line, i) => {
    const lineNumber = i + 1;
    const consoleMatch = consoles.find(c => line.includes(c));
    
    if (consoleMatch) {
      if (lineOutputMap.has(lineNumber)) {
        // This console statement was executed
        const outputs = lineOutputMap.get(lineNumber)!;
        const fullLog = outputs[0];
        const trimmedLog = fullLog.trim();
        
        // Create short version for inline display
        const short = trimmedLog.length > config.TRUNCATE_LENGTH
          ? trimmedLog.slice(0, config.TRUNCATE_LENGTH - 3).replace(/\s+/g, ' ') + '...'
          : trimmedLog;

        // Determine icon based on console method
        const icon = getConsoleIcon(consoleMatch);
        
        executedDecorations.push({
          range: new vscode.Range(i, line.length, i, line.length),
          renderOptions: {
            after: {
              contentText: `${icon} => ${short}`,
              color: getConsoleColor(consoleMatch),
              fontStyle: 'italic',
              margin: '0 0 0 1em'
            }
          },
          hoverMessage: createHoverMessage(trimmedLog, consoleMatch)
        });
      } else {
        // This console statement was not executed
        const icon = getConsoleIcon(consoleMatch);
        
        nonExecutedDecorations.push({
          range: new vscode.Range(i, line.length, i, line.length),
          renderOptions: {
            after: {
              contentText: `${icon} (not executed)`,
              color: '#888888', // Gray color for non-executed
              fontStyle: 'italic',
              margin: '0 0 0 1em'
            }
          },
          hoverMessage: new vscode.MarkdownString(`**${consoleMatch}** - Not executed during runtime`)
        });
      }
    }
  });

  // Apply decorations
  if (executedDecorationType) executedDecorationType.dispose();
  if (nonExecutedDecorationType) nonExecutedDecorationType.dispose();
  
  executedDecorationType = vscode.window.createTextEditorDecorationType({});
  nonExecutedDecorationType = vscode.window.createTextEditorDecorationType({});
  
  editor.setDecorations(executedDecorationType, executedDecorations);
  editor.setDecorations(nonExecutedDecorationType, nonExecutedDecorations);
}

// Legacy function wrapper for backward compatibility
function processOutputAndDecorate(
  code: string, 
  stdout: string, 
  stderr: string, 
  editor: vscode.TextEditor
) {
  createCombinedDecorations(code, stdout, stderr, editor);
}

// Get appropriate icon for console method
function getConsoleIcon(consoleMethod: string): string {
  switch (consoleMethod) {
    case 'console.error': return '❌';
    case 'console.warn': return '⚠️';
    case 'console.info': return 'ℹ️';
    case 'console.debug': return '🐛';
    case 'console.table': return '📊';
    case 'console.dir': return '📁';
    case 'console.trace': return '🔍';
    default: return '💭';
  }
}

// Get appropriate color for console method
function getConsoleColor(consoleMethod: string): string {
  switch (consoleMethod) {
    case 'console.error': return '#ff6b6b';
    case 'console.warn': return '#ffa500';
    case 'console.info': return '#4dabf7';
    case 'console.debug': return '#69db7c';
    case 'console.table': return '#9775fa';
    case 'console.dir': return '#74c0fc';
    case 'console.trace': return '#ff8cc8';
    default: return 'gray';
  }
}

// Create rich hover message
function createHoverMessage(output: string, consoleMethod: string): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString();
  
  markdown.appendMarkdown(`**${consoleMethod}** output:\n\n`);
  
  // Try to detect if it's JSON-like and format it
  try {
    if (output.includes('{') || output.includes('[')) {
      // Attempt to parse and pretty-print JSON-like output
      const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        markdown.appendCodeblock(JSON.stringify(parsed, null, 2), 'json');
        return markdown;
      }
    }
  } catch (e) {
    // If JSON parsing fails, fall back to regular display
  }
  
  markdown.appendCodeblock(output, 'javascript');
  return markdown;
}



function clearDecorations() {
  if (decorationType) {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(decorationType, []);
    }
    decorationType.dispose();
    decorationType = null;
  }
  
  if (executedDecorationType) {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(executedDecorationType, []);
    }
    executedDecorationType.dispose();
    executedDecorationType = null;
  }
  
  if (nonExecutedDecorationType) {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(nonExecutedDecorationType, []);
    }
    nonExecutedDecorationType.dispose();
    nonExecutedDecorationType = null;
  }
}

export function deactivate() {
  clearDecorations();
}
