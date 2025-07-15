import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let enabled = false;
let decorationType: vscode.TextEditorDecorationType | null = null;

export function activate(context: vscode.ExtensionContext) {
  const toggleCommand = vscode.commands.registerCommand('inlineConsole.toggle', () => {
    enabled = !enabled;
    vscode.window.showInformationMessage(`Inline Console Logs ${enabled ? 'Enabled' : 'Disabled'}`);

    if (enabled && vscode.window.activeTextEditor) {
      updateDecorations(vscode.window.activeTextEditor.document);
    } else {
      clearDecorations();
    }
  });

  context.subscriptions.push(toggleCommand);

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


const consoles = ['console.log', 'console.debug', 'console.info'];
function updateDecorations(doc: vscode.TextDocument) {
  if (doc.languageId !== 'javascript' && doc.languageId !== 'typescript') return;

  const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
  if (!editor) return;

  const code = doc.getText();
  const tmpFile = path.join(os.tmpdir(), `inline-log-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, code);

  cp.exec(`node "${tmpFile}"`, (err, stdout, stderr) => {
    fs.unlinkSync(tmpFile);
    if (err) return;

    const lines = code.split('\n');
    const outputLines = stdout.trim().split('\n');

    // Capture multiline log output
    const logs: string[] = [];
    let current = '';
    outputLines.forEach(line => {
      if (/^\s*$/.test(line)) return;

      if (line.startsWith(' ')) {
        // continuation line
        current += '\n' + line;
      } else {
        if (current) logs.push(current);
        current = line;
      }
    });
    if (current) logs.push(current); // last

    const decorations: vscode.DecorationOptions[] = [];
    let logIndex = 0;

    lines.forEach((line, i) => {
      if (consoles.some(c => line.includes(c)) && logIndex < logs.length) {
        const fullLog = logs[logIndex++];
        const short = fullLog.length > 60
          ? fullLog.slice(0, 57).replace(/\s+/g, ' ') + '...'
          : fullLog;

        decorations.push({
          range: new vscode.Range(i, line.length, i, line.length),
          renderOptions: {
            after: {
              contentText: `💭 => ${short}`,
              color: 'gray',
              fontStyle: 'italic',
            }
          },
          hoverMessage: new vscode.MarkdownString()
            .appendCodeblock(fullLog, 'javascript')
        });
      }
    });

    if (decorationType) decorationType.dispose();
    decorationType = vscode.window.createTextEditorDecorationType({});
    editor.setDecorations(decorationType, decorations);
  });
}



function clearDecorations() {
  if (decorationType) {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(decorationType, []);
    }
    decorationType.dispose();
    decorationType = null;
  }
}

export function deactivate() {
  clearDecorations();
}
