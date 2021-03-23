/* Inspired by the following:
- https://github.com/mattogodoy/hacker-sounds/blame/master/src/player.ts
- https://github.com/jengjeng/aural-coding-vscode/blob/master/src/lib/player.ts
*/

const cp = require('child_process');
const path = require('path');
const player = require('play-sound')();

const _isWindows = process.platform === 'win32';
const _playerWindowsPath = path.join(__dirname, '..', 'audio', 'sounder.exe');

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

export const play = (soundName: string, soundCategory: string = "hacker", config: PlayerConfig) : Promise<void> => {
  return new Promise ((resolve, reject) => {
    if (_isWindows) {
      // no Windows support yet :/
      resolve();
      return;
    }
    const filePath = path.join(__dirname, "../../audio/", soundCategory, `${soundName}.mp3`);
    player.play(filePath, playerAdapter(config), (err: any) => {
      if (err) {
        console.error("Error playing sound:", filePath, " - Description:", err);
        return reject(err);
      }
      resolve();
    });
  });
};


