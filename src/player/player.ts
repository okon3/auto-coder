/* Inspired by the following:
- https://github.com/mattogodoy/hacker-sounds/blame/master/src/player.ts
- https://github.com/jengjeng/aural-coding-vscode/blob/master/src/lib/player.ts
*/

import * as cp from 'child_process';
import * as path from 'path';
// @ts-ignore
import * as sound from 'sound-play';

export const play = (soundName: string, soundCategory: string = 'hacker') : Promise<void> => {
  return new Promise ((resolve) => {
    const filePath = path.join(__dirname, "../audio/", soundCategory, `${soundName}.mp3`);
    sound.play(filePath)
      .then(resolve)
      .catch((err: Error) => {
        console.error(err);
        return;
      });
  });
};
