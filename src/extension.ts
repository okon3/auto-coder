// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { play } from './player/player';

let currentPageNum = 0;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "auto-type" is now active!');

    let disposable = vscode.commands.registerCommand('extension.resetCodeScript', () => {
      currentPageNum = 0;
    });

    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('extension.completeCodeScript', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const ws = vscode.workspace;

      if (!vscode.workspace.workspaceFolders) {
        return;
      }

      const rootDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const scriptDirName = '.auto-type';
      const scriptDir = path.join(rootDir, scriptDirName);

      let scriptPages;
      try {
        scriptPages = loadScript(scriptDir);
      }
      catch (e) {
        vscode.window.showWarningMessage(e);
        return;
      }

      if (currentPageNum >= scriptPages.length) {
        vscode.window.showInformationMessage('No more script pages.');
        return;
      }

      const scriptPage = scriptPages[currentPageNum];
      currentPageNum += 1;

      const files = scriptPages.map(scriptPage => scriptPage.file );

      const docPromises = files.map(file => {
        const fqfn = (file.indexOf('/') === 0) ? file : path.join(rootDir, file);
        return ws.openTextDocument(fqfn).then(doc => {
          vscode.window.showTextDocument(doc, {preview: false});
        });
      });

      Promise.all(docPromises).then(() => {
        const docs = ws.textDocuments;
        const changeDoc = docs.find(doc => doc.fileName.indexOf(scriptPage.file) > -1);

        if (!changeDoc) {
          return;
        }

        vscode.window.showTextDocument(changeDoc).then(() => {
            const range = changeDoc.lineAt(scriptPage.line).range;
            if (vscode.window.activeTextEditor) {
              vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.end);
              vscode.window.activeTextEditor.revealRange(range, scriptPage.align);
            }

            const pos = new vscode.Position(scriptPage.line, scriptPage.col);
            const changeText = typeof(scriptPage.content) === 'string' ? scriptPage.content : scriptPage.content.join('');
            type(changeText, pos);
          });
      });
    });

    context.subscriptions.push(disposable);

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    disposable = vscode.commands.registerCommand('extension.playCodeScript', () => {
      // The code you place here will be executed every time your command is executed

      let editor = vscode.window.activeTextEditor;
      if (!editor) {return;}

      let ws = vscode.workspace;

      if (!vscode.workspace.workspaceFolders) {
        return;
      }

      const rootDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const scriptDirName = '.auto-type';
      const scriptDir = path.join(rootDir, scriptDirName);

      let scriptPages;
      try {
        scriptPages = loadScript(scriptDir);
      }
      catch (e) {
        vscode.window.showWarningMessage(e);
        return;
      }

      if (currentPageNum >= scriptPages.length) {
        vscode.window.showInformationMessage('No more script pages.');
        return;
      }

      let scriptPage = scriptPages[currentPageNum];
      currentPageNum += 1;

      let files = scriptPages.map(scriptPage => scriptPage.file );

      let docPromises = files.map(file => {
        let fqfn = (file.indexOf('/') === 0) ? file : path.join(rootDir, file);
        return ws.openTextDocument(fqfn).
                  then(doc => {
                    vscode.window.showTextDocument(doc, {preview: false});
                  });
      });

      Promise.all(docPromises).then(() => {
        const docs = ws.textDocuments;
        const changeDoc = docs.find(doc => doc.fileName.indexOf(scriptPage.file) > -1);

        if (!changeDoc) {
          return;
        }

        vscode.window.showTextDocument(changeDoc).then(() => {
            const range = changeDoc.lineAt(scriptPage.line).range;
            if (vscode.window.activeTextEditor) {
              vscode.window.activeTextEditor.selection =  new vscode.Selection(range.start, range.end);
              vscode.window.activeTextEditor.revealRange(range, scriptPage.align);
            }

            const pos = new vscode.Position(scriptPage.line, scriptPage.col);
            const changeText = typeof(scriptPage.content) === 'string' ? scriptPage.content : scriptPage.content.join('');
            type(changeText, pos);
          });
      });
    });

    context.subscriptions.push(disposable);
}

interface ScriptPage extends FrontMatter {
  name: string;
  path: string;
  content: string | string[];
}

function loadScript(scriptDir: string): ScriptPage[] {
  if (!fs.existsSync(scriptDir)) {
    vscode.window.showWarningMessage(`The script directory ${scriptDir} does not exist. Nothing for auto-type to do.`);
    return [];
  }
  const pages = fs.readdirSync(scriptDir);
  if (!pages.length) {
    vscode.window.showWarningMessage(`No script pages found in ${scriptDir}. Nothing for auto-type to do.`);
    return [];
  }
  return pages.map(pageName => {
    return parseScriptPage(pageName, scriptDir);
  });
}

function parseScriptPage(pageName: string, scriptDir: string): ScriptPage {
  const pagePath = path.join(scriptDir, pageName);
  const fullContent = fs.readFileSync(pagePath, {encoding: 'utf-8'});
  const parts = fullContent.split(/\n\-\-\-\n/m);

  let frontMatter, content;
  try {
    frontMatter = parseFrontMatter(parts[0]);
    content = parts[1];
  }
  catch (e) {
    throw new Error(`${e} in script page ${pagePath}`);
  }

  const options = {
    file: frontMatter.file,
    name: pageName,
    path: pagePath,
    content: content,
    line: frontMatter.line,
    col: frontMatter.col,
    align: frontMatter.align,
  };

  if (!options.file) {
    throw new Error("Missing file property");
  }
  if (!fs.existsSync(options.file) && !fs.existsSync(scriptDir + '/../' + options.file)) {
    throw new Error(`Can't find target file  ${options.file}`);
  }

  return options;
}

interface FrontMatter {
  file: string;
  line: number;
  col: number;
  align: vscode.TextEditorRevealType | undefined;
}

function parseFrontMatter(text: string): FrontMatter {
  const rawOptions = text.split("\n").reduce((accumulator, line) => {
    const [lineKey, lineVal] = line.split(/\s*:\s*/);
    return {
      [lineKey]: lineVal,
      ...accumulator,
    };
  }, {} as {
    [key: string]: string;
  });

  // Either parse the provided line or use 1, then 0-index it
  const line = (rawOptions.line ? parseInt(rawOptions.line, 10) : 1) - 1;
  const col = (rawOptions.col ? parseInt(rawOptions.col, 10) : 1) - 1;

  // See https://code.visualstudio.com/api/references/vscode-api#TextEditorRevealType
  const align = rawOptions.align || 'middle';
  const newAlign = align === 'middle' ? 2 : 3;

  return {
    file: rawOptions.file,
    line,
    col,
    align: newAlign
  };
}

async function timedCharacterType(text: string, currentPosition: vscode.Position, delay: number) {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !text || text.length === 0) {return;}

  triggerKeySound();
  let { newPosition, char } = getTypingInfo(text, currentPosition, editor);

  await editor.edit(editBuilder => {
    if (char !== '⌫') {
      editBuilder.insert(newPosition, char);
    }
    else {
      let selection = new vscode.Selection(newPosition, currentPosition);
      editBuilder.delete(selection);
      char = '';
    }

    let newSelection = new vscode.Selection(newPosition, newPosition);
    if (char === "\n") {
      newSelection = new vscode.Selection(currentPosition, currentPosition);
      newPosition = new vscode.Position(currentPosition.line + 1, 0);
      char = '';
    }

    editor.selection = newSelection;
  });
  await pause(delay);
  return { };
}

function pause(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTypingInfo(text: string, currentPosition: vscode.Position, editor: vscode.TextEditor) {
  const char = text.substring(0, 1);
  if (char === '↓') {
    return {
      newPosition: new vscode.Position(currentPosition.line + 1, currentPosition.character),
      char: '',
    };
  }
  if (char === '↑') {
    return {
      newPosition: new vscode.Position(currentPosition.line - 1, currentPosition.character),
      char: '',
    };
  }
  if (char === '→') {
    return {
      newPosition: new vscode.Position(currentPosition.line, currentPosition.character + 1),
      char: '',
    };
  }
  if (char === '←') {
    return {
      newPosition: new vscode.Position(currentPosition.line, currentPosition.character - 1),
      char: '',
    };
  }
  if (char === '⇤') {
    return {
      newPosition: new vscode.Position(currentPosition.line, 0),
      char: '',
    };
  }
  if (char === '⇥') {
    return {
      newPosition: editor.document.lineAt(currentPosition.line).range.end,
      char: '',
    };
  }
  if (char === '⌫') {
    return {
      newPosition: new vscode.Position(currentPosition.line, currentPosition.character - 1),
      char,
    };
  }
  return {
    newPosition: currentPosition,
    char,
  };
}

const triggerKeySound = () => {
  const config = vscode.workspace.getConfiguration('autoCoder');
  const soundEffectSetting = config.get('soundEffects', 'keyboard');
  const playerConfig = {
      macVol: 10,
      winVol: 10,
      linuxVol: 10,
  };
  play('key', soundEffectSetting, playerConfig);
};

const getCharacterTypeDelay = () => {
  const config = vscode.workspace.getConfiguration('autoCoder');
  const baseDelay = config.get('baseCharacterDelay', 20);
  const variableDelay = config.get('baseCharacterDelay', 80);
  return baseDelay + variableDelay * Math.random();
};

function type(textRemaining: string, currentPosition: vscode.Position) {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !textRemaining || textRemaining.length === 0) {return;}

  triggerKeySound();
  let { newPosition, char } = getTypingInfo(textRemaining, currentPosition, editor);

  editor.edit(editBuilder => {
    if (char === '⌫') {
      let selection = new vscode.Selection(newPosition, currentPosition);
      editBuilder.delete(selection);
      char = '';
    }
    else {
      editBuilder.insert(newPosition, char);
    }

    let newSelection = new vscode.Selection(newPosition, newPosition);
    if (char === "\n") {
      newSelection = new vscode.Selection(currentPosition, currentPosition);
      newPosition = new vscode.Position(currentPosition.line + 1, 0);
      char = '';
    }

    editor.selection = newSelection;
  }).then(() => {
    const delay = getCharacterTypeDelay();
    const _p = new vscode.Position(newPosition.line, char.length + newPosition.character);
    setTimeout(() => {
      type(textRemaining.substring(1, textRemaining.length), _p);
    }, delay);
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
}
