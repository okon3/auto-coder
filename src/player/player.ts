/* Inspired by the following:
- https://github.com/mattogodoy/hacker-sounds/blame/master/src/player.ts
- https://github.com/jengjeng/aural-coding-vscode/blob/master/src/lib/player.ts
*/

import * as fs from 'fs';
const path = require('path');
const player = require('play-sound')();

const _isWindows = process.platform === 'win32';

export interface PlayerConfig {
    /**
     * Specify volume of the sounds
     */
    macVol: number;
    winVol: number;
    linuxVol: number;
}

const playerAdapter = (opts: PlayerConfig) => ({
    afplay: ['-v', opts.macVol],
    mplayer: ['-af', `volume=${opts.linuxVol}`],
});

const getRandomFile = (dirPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, items) => {
      if (err) {
        reject(err);
      }

      const fileIndex = Math.round(Math.random() * (items.length - 1));
      resolve(items[fileIndex]);
    });
  });
};

export const play = async (soundName: string, soundCategory: string = "hacker", config: PlayerConfig): Promise<void> => {
  if (_isWindows) {
    // no Windows support yet :/
    return;
  }
  const fileDirectory = path.join(__dirname, "../../audio/", soundCategory, soundName);
  const fileName = await getRandomFile(fileDirectory);
  const filePath = path.join(fileDirectory, fileName);
  player.play(filePath, playerAdapter(config), (err: any) => {
    if (err) {
      console.error("Error playing sound:", filePath, " - Description:", err);
    }
  });
};


