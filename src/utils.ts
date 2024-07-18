// Node modules.
import fs from 'fs-extra';
import fetch from 'node-fetch';

const hostUrl = 'https://www.picuki.com/';

const downloadImage = async (url: string, destination: string) => {
  const response = await fetch(url);
  const buffer = await response.buffer();
  await fs.writeFile(destination, buffer);
}

export {
  hostUrl,
  downloadImage,
};
