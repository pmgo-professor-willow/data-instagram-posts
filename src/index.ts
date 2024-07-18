// Node modules.
import _ from 'lodash';
import { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import { parse } from 'node-html-parser';
import { mkdirp, writeFile } from 'fs-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Local modules.
import { downloadImage, hostUrl } from './utils';
import IG_USERS from '../data/instagram-users.json';

interface Post {
  id: string;
  text: string;
  mediaList: { url: string }[];
  createdAt: string;
};

const getPost = async (page: Page, url: string): Promise<Post> => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // 'https://www.picuki.com/media/3167389780732852671' => '3167389780732852671'
  const mediaId = url.split('/').pop()!;
  
  const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);
  const root = parse(xml);
  const text = root.querySelector('.single-photo-description')?.text ?? '';
  const createdAt = root.querySelector('.single-photo-time')?.text ?? '';
  const rawImageLinks = root.querySelectorAll('.single-photo.owl-carousel .owl-item img, .single-photo img')
    .map((imageItem) => imageItem.getAttribute('src')!);

  // Download images
  const mediaList: Post['mediaList'] = [];
  for (let i = 0; i < rawImageLinks.length; i++) {
    const storageBaseUrl = 'https://pmgo-professor-willow.github.io/data-instagram-posts/';
    const filename = `${mediaId}_${i+1}.jpg`;
    const imagePath = `./artifacts/${filename}`;
    mediaList.push({ url: new URL(filename, storageBaseUrl).href });

    await downloadImage(rawImageLinks[i], imagePath);
  }

  return {
    id: mediaId,
    text,
    mediaList,
    createdAt,
  };
};

const getPosts = async (page: Page, userId: string): Promise<Post[]> => {
  const url = new URL(`profile/${userId}`, hostUrl).href;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });

  const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);

  const root = parse(xml);
  const linkItems = root.querySelectorAll('.box-photo[data-s=media] .photo a');

  const links = linkItems.map((linkItem) => linkItem.getAttribute('href')!);

  const posts: Post[] = [];

  for (const link of links.slice(0, 10)) {
    console.log(`Current link: ${link}`);

    const post = await getPost(page, link);
    posts.push(post);

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  return posts;
};

const main = async () => {
  const outputPath = './artifacts';
  await mkdirp(outputPath);

  const browser = await puppeteer.use(StealthPlugin()).launch({
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXEC_PATH, // set by docker container
    headless: false,
  });
  const [page] = await browser.pages();

  const postList: { username: string; posts: Post[] }[] = [];

  for (const igUser of IG_USERS) {
    const posts = await getPosts(page, igUser.username);

    postList.push({
      username: igUser.username,
      posts,
    })
  }

  await browser.close();

  await writeFile(`${outputPath}/instagram-posts.min.json`, JSON.stringify(postList));
  await writeFile(`${outputPath}/instagram-posts.json`, JSON.stringify(postList, null, 2));
};

main();
