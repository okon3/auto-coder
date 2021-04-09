// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { play } from './player/player';

let currentPageNum = 0;

const typeOutCoderScript = async (changeDoc: vscode.TextDocument, scriptPage: ScriptPage) => {
  const range = changeDoc.lineAt(scriptPage.line).range;
  if (vscode.window.activeTextEditor) {
    vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.end);
    vscode.window.activeTextEditor.revealRange(range, scriptPage.align);
  }

  if (!vscode.window.activeTextEditor) {
    return;
  }

  let cursorPosition = new vscode.Position(scriptPage.line, scriptPage.col);
  const changeText = typeof(scriptPage.content) === 'string' ? scriptPage.content : scriptPage.content.join('');
  const inputCharacters = changeText.split("");

  // TODO: Look at where these should come from and be set
  let char = getInsertionCharacter(inputCharacters[0]);
  let newPosition = getNewPosition(inputCharacters[0], cursorPosition, vscode.window.activeTextEditor);
  // TODO: Look at where these should come from and be set

  const delay = getCharacterTypeDelay();
  for (let i = 0; i < inputCharacters.length; i++) {
    const currentCharacter = inputCharacters[i];
    timedCharacterType(currentCharacter, cursorPosition, delay);

    // TODO: Are the right params being passed here?
    cursorPosition = getNextPosition(char, newPosition, cursorPosition);
    await pause(delay);
  }
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "auto-type" is now active!');

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = "$(play) Run AutoCoder Script";
    statusBarItem.command = "extension.playCodeScript";
    statusBarItem.show();

    const resetCodeScriptCommand = vscode.commands.registerCommand('extension.resetCodeScript', () => {
      currentPageNum = 0;
    });

    context.subscriptions.push(resetCodeScriptCommand);

    const completeCodeScriptCommand = vscode.commands.registerCommand('extension.completeCodeScript', () => {
      const editor = vscode.window.activeTextEditor;
      const ws = vscode.workspace;

      if (!editor || !ws.workspaceFolders) {
        return;
      }

      const rootDir = ws.workspaceFolders[0].uri.fsPath;
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
          typeOutCoderScript(changeDoc, scriptPage);
        });
      });
    });

    context.subscriptions.push(completeCodeScriptCommand);

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const playCodeScriptCommand = vscode.commands.registerCommand('extension.playCodeScript', () => {

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
              vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.end);
              vscode.window.activeTextEditor.revealRange(range, scriptPage.align);
            }

            const pos = new vscode.Position(scriptPage.line, scriptPage.col);
            const changeText = typeof(scriptPage.content) === 'string' ? scriptPage.content : scriptPage.content.join('');
            type(changeText, pos);
          });
      });
    });

    context.subscriptions.push(playCodeScriptCommand);
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

async function timedCharacterType(charInput: string, currentPosition: vscode.Position, delay: number) {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !charInput || charInput.length === 0) {return;}

  triggerKeySound();
  let char = getInsertionCharacter(charInput);
  let newPosition = getNewPosition(charInput, currentPosition, editor);

  await editor.edit(editBuilder => {
    if (deletionCharacters.indexOf(char) > -1) {
      let selection = new vscode.Selection(newPosition, currentPosition);
      editBuilder.delete(selection);
      char = '';
    }
    else if (char === '⌧') {
      const currentLineStart = editor.document.lineAt(currentPosition.line).range.start;
      const currentLineEnd = editor.document.lineAt(currentPosition.line).range.end;
      const nextLineStart = editor.document.lineAt(currentPosition.line + 1).range.start;
      const isLastLine = false; // TODO: This fails on the last line of a file
      const endSelection = isLastLine ? currentLineEnd : nextLineStart;
      const selection = new vscode.Selection(endSelection, currentLineStart);
      editBuilder.delete(selection);
      char = '';
    }
    else {
      editBuilder.insert(newPosition, char);
      const isAtVerticalLimit = newPosition.line > editor.visibleRanges[0].end.line - 1;
      if (isAtVerticalLimit) {
        const range = {
          start: newPosition,
          end: newPosition,
        } as vscode.Range;
        editor.revealRange(range, 0);
      }
    }

    editor.selection = getNewSelection(char, newPosition, currentPosition);
  });
}

function pause(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const triggerKeySound = () => {
  const soundEffectSettings = [
    'none',
    'macbook',
    'keyboard',
    'hacker',
  ];
  const config = vscode.workspace.getConfiguration('autoCoder');
  const soundEffectSetting = config.get('soundEffects', 'none');
  if (soundEffectSettings.indexOf(soundEffectSetting) < 1) {
    return;
  }
  const playerConfig = {
      macVol: 5,
      winVol: 5,
      linuxVol: 5,
  };
  play('key', soundEffectSetting, playerConfig);
};

const getCharacterTypeDelay = () => {
  const config = vscode.workspace.getConfiguration('autoCoder');
  const baseDelay = config.get('characterDelayBase', 20);
  const variableDelay = config.get('characterDelayVariation', 80);
  return baseDelay + variableDelay * Math.random();
};

const deletionCharacters = ['⌫', '⌦', '↚', '↛'];
const moveCursorCharacters = [
  '↓',
  '↑',
  '→',
  '←',
  '⇤',
  '⇥',
];
const newLineCharacter = '\n';

const getInsertionCharacter = (charInput: string) => {
  if (deletionCharacters.indexOf(charInput) > -1) {
    return charInput;
  }
  if (charInput === '⌧') {
    return '';
  }
  if (moveCursorCharacters.indexOf(charInput) > -1) {
    return '';
  }
  if (charInput === '¬') {
    return '';
  }
  if (charInput === newLineCharacter) {
    return charInput;
  }
  return charInput;
};

const getNewPosition = (inputChar: string, currentPosition: vscode.Position, editor: vscode.TextEditor) => {
  // Moving cursor
  if (inputChar === '↓') {
    return new vscode.Position(currentPosition.line + 1, currentPosition.character);
  }
  if (inputChar === '↑') {
    return new vscode.Position(currentPosition.line - 1, currentPosition.character);
  }
  if (inputChar === '→') {
    return new vscode.Position(currentPosition.line, currentPosition.character + 1);
  }
  if (inputChar === '←') {
    return new vscode.Position(currentPosition.line, currentPosition.character - 1);
  }
  if (inputChar === '⇤') {
    return new vscode.Position(currentPosition.line, 0);
  }
  if (inputChar === '⇥') {
    return editor.document.lineAt(currentPosition.line).range.end;
  }
  if (inputChar === '⌫') {
    // Delete char left
    const newCol = currentPosition.character > 0 ? currentPosition.character - 1 : 0;
    return new vscode.Position(currentPosition.line, newCol);
  }
  if (inputChar === '⌦') {
    // Delete char right
    const endChar = editor.document.lineAt(currentPosition.line).range.end.character;
    const newCol = currentPosition.character < endChar ? currentPosition.character + 1 : currentPosition.character;
    return new vscode.Position(currentPosition.line, newCol);
  }
  if (inputChar === '↚') {
    // Delete all left
    return new vscode.Position(currentPosition.line, 0);
  }
  if (inputChar === '↛') {
    // Delete all right
    return editor.document.lineAt(currentPosition.line).range.end;
  }
  if (inputChar === '⌧') {
    // Remove the line completely
    return new vscode.Position(currentPosition.line, currentPosition.character - 1);
  }
  // Normal text insertion
  return currentPosition;
};

function type(textRemaining: string, currentPosition: vscode.Position) {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !textRemaining || textRemaining.length === 0) {return;}

  triggerKeySound();
  const charInput = textRemaining.substring(0, 1);
  let char = getInsertionCharacter(charInput);
  const newPosition = getNewPosition(charInput, currentPosition, editor);

  editor.edit(editBuilder => {
    if (deletionCharacters.indexOf(char) > -1) {
      let selection = new vscode.Selection(newPosition, currentPosition);
      editBuilder.delete(selection);
      char = '';
    }
    else if (char === '⌧') {
      const currentLineStart = editor.document.lineAt(currentPosition.line).range.start;
      const currentLineEnd = editor.document.lineAt(currentPosition.line).range.end;
      const nextLineStart = editor.document.lineAt(currentPosition.line + 1).range.start;
      const isLastLine = false; // TODO: This fails on the last line of a file
      const endSelection = isLastLine ? currentLineEnd : nextLineStart;
      const selection = new vscode.Selection(endSelection, currentLineStart);
      editBuilder.delete(selection);
      // TODO: Set newPosition
      char = '';
    }
    else {
      editBuilder.insert(newPosition, char);
      // TODO: Add horizontal limit
      // TODO: Fix issue on newline (doesn't focus until character is typed)
      const isAtVerticalLimit = newPosition.line > editor.visibleRanges[0].end.line - 1;
      if (isAtVerticalLimit) {
        const range = {
          start: newPosition,
          end: newPosition,
        } as vscode.Range;
        editor.revealRange(range, 0);
        // vscode.commands.executeCommand("revealLine", { // This could also work, it's used in https://github.com/kaiwood/vscode-center-editor-window/blob/master/src/extension.ts#L60
        //   lineNumber: newPosition.line,
        //   at: "bottom"
        // });
      }
    }

    editor.selection = getNewSelection(char, newPosition, currentPosition);
  }).then(() => {
    const delay = getCharacterTypeDelay();
    const nextPosition = getNextPosition(char, newPosition, currentPosition);
    setTimeout(() => {
      type(textRemaining.substring(1, textRemaining.length), nextPosition);
    }, delay);
  });
}

// Gets the position of the cursor for the next character that should be typed
const getNextPosition = (previousChar: string, newPosition: vscode.Position, currentPosition: vscode.Position) => {
  if (previousChar === "\n") {
    return new vscode.Position(currentPosition.line + 1, 0);
  }
  return new vscode.Position(newPosition.line, newPosition.character + 1);
};

// Gets the new selection for the editor, I don't fully understand this one TBH
const getNewSelection = (char: string, newPosition: vscode.Position, currentPosition: vscode.Position) => {
  if (char === "\n") {
    return new vscode.Selection(currentPosition, currentPosition);
  }
  return new vscode.Selection(newPosition, newPosition);
};

// this method is called when your extension is deactivated
export function deactivate() {
}
