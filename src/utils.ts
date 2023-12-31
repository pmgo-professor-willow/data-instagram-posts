// Node modules.
import https from 'https';
import fs from 'fs-extra';

const hostUrl = 'https://www.picuki.com/';

const download = (url: string, destination: string) => new Promise((resolve, reject) => {
  const file = fs.createWriteStream(destination);

  https.get(url, response => {
    response.pipe(file);

    file.on('finish', () => {
      file.close();
      resolve(true);
    });
  }).on('error', error => {
    fs.unlink(destination);
    reject(error.message);
  });
});

export {
  hostUrl,
  download,
};
