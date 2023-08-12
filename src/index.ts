// Node modules.
import _ from 'lodash';
import { parse } from 'node-html-parser';
import { Page } from 'puppeteer';
import { mkdirp, writeFile } from 'fs-extra';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Local modules.
import { hostUrl } from './utils';
import IG_USERS from '../data/instagram-users.json';

interface Post {
  contentText: string;
  timestamp: string;
  imageLinks: string[];
};

const getPost = async (page: Page, path: string): Promise<Post> => {
  const url = new URL(path, hostUrl).href;
  await page.goto(url, { waitUntil: 'networkidle0' });

  let contentText = '';
  let datetimeText = '';
  const imageLinkSet = new Set<string>();

  for (const _time of _.range(10)) {
    const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);
    const root = parse(xml);
    const imageItems = root.querySelectorAll('[role=presentation] [role=presentation] img[srcset]');
    const hasNextButton = root.querySelector('[role=presentation] button[aria-label=Next]');

    contentText = root.querySelector('[role=presentation] [role=presentation] h1')?.structuredText ?? '';
    datetimeText = root.querySelector('[role=presentation] [role=presentation] a time')?.getAttribute('datetime') ?? '';
  
    imageItems.forEach((imageItem) => imageLinkSet.add(imageItem.getAttribute('src')!));
  
    if (hasNextButton) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.click('[role=presentation] button[aria-label=Next]');
    } else {
      break;
    }
  }

  const imageLinks = Array.from(imageLinkSet);

  return {
    contentText,
    timestamp: new Date(datetimeText).toISOString(),
    imageLinks,
  };
};

const getPosts = async (page: Page, userId: string): Promise<Post[]> => {
  const url = new URL(userId, hostUrl).href;
  await page.goto(url, { waitUntil: 'networkidle0' });
  const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);

  console.log(xml);

  const root = parse(xml);
  const linkItems = root.querySelectorAll('article > div > div > div > div > a');

  const links = linkItems.map((linkItem) => linkItem.getAttribute('href')!);

  const posts: Post[] = [];

  // FIXME: For testing.
  for (const link of links.slice(0, 6)) {
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
