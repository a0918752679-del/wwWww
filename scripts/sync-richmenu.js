import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const apiBase = 'https://api.line.me';
const dataApiBase = 'https://api-data.line.me';
const PROJECT_MENU_PREFIXES = ['WW Beyblade V7', 'WW Beyblade V8', 'WW Beyblade V9', 'WW Beyblade V10'];
const PROJECT_ALIASES = ['ww-page1', 'ww-page2', 'ww-page3'];

if (!token) {
  console.error('缺少 LINE_CHANNEL_ACCESS_TOKEN，請先在 Zeabur Variables 設定 Messaging API Channel access token。');
  process.exit(1);
}

function uri(pathname) {
  return `${BASE_URL}${pathname}`;
}

function headers(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function request(base, method, endpoint, body, extraHeaders = {}) {
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers: headers(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json', ...extraHeaders } : extraHeaders),
    body: body ? (body instanceof Buffer ? body : JSON.stringify(body)) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${base}${endpoint} failed ${res.status}: ${text}`);
  }
  return data;
}

async function line(method, endpoint, body, extraHeaders = {}) {
  return request(apiBase, method, endpoint, body, extraHeaders);
}

async function lineData(method, endpoint, body, extraHeaders = {}) {
  return request(dataApiBase, method, endpoint, body, extraHeaders);
}

function area(x, y, width, height, action) {
  return { bounds: { x, y, width, height }, action };
}

const switchTo = (alias, label = '') => ({ type: 'richmenuswitch', richMenuAliasId: alias, data: label || alias });
const open = (pathname) => ({ type: 'uri', uri: uri(pathname) });
const message = (text) => ({ type: 'message', text });

// V10 改為 2500x1350，移除上方 PAGE/分頁按鈕列。
// LINE Rich Menu 不支援真正的滑動動畫，因此以左右窄邊點擊區做上一頁/下一頁切換。
const MENU_W = 2500;
const MENU_H = 1350;
const SIDE_W = 150;
const CONTENT_W = MENU_W - SIDE_W * 2;

const sideSwitchAreas = (prevAlias, nextAlias) => [
  area(0, 0, SIDE_W, MENU_H, switchTo(prevAlias, 'prev-page')),
  area(MENU_W - SIDE_W, 0, SIDE_W, MENU_H, switchTo(nextAlias, 'next-page'))
];

const menus = [
  {
    key: 'page1',
    alias: 'ww-page1',
    name: 'WW Beyblade V10 Page 1 Home',
    image: path.join(root, 'public/assets/richmenu/page1.jpg'),
    chatBarText: '選單',
    areas: [
      ...sideSwitchAreas('ww-page3', 'ww-page2'),
      // main cards, adjusted for 2500x1350 after removing the old top header
      area(SIDE_W, 120, 683, 465, open('/#pools')),
      area(833, 120, 834, 465, open('/#shop')),
      area(1667, 120, 683, 465, switchTo('ww-page2', 'go-records')),
      area(SIDE_W, 615, 475, 472, open('/#rules')),
      area(625, 615, 625, 472, open('/#member')),
      area(1250, 615, 625, 472, message('客服')),
      area(1875, 615, 475, 472, switchTo('ww-page3', 'go-news'))
    ]
  },
  {
    key: 'page2',
    alias: 'ww-page2',
    name: 'WW Beyblade V10 Page 2 Records',
    image: path.join(root, 'public/assets/richmenu/page2.jpg'),
    chatBarText: '選單',
    areas: [
      ...sideSwitchAreas('ww-page1', 'ww-page3'),
      // record cards
      area(SIDE_W, 75, 475, 810, open('/#draws')),
      area(625, 75, 625, 810, open('/#history')),
      area(1250, 75, 625, 810, open('/#shipping')),
      area(1875, 75, 475, 810, open('/#wallet')),
      area(SIDE_W, 930, CONTENT_W, 375, open('/#member'))
    ]
  },
  {
    key: 'page3',
    alias: 'ww-page3',
    name: 'WW Beyblade V10 Page 3 News',
    image: path.join(root, 'public/assets/richmenu/page3.jpg'),
    chatBarText: '選單',
    areas: [
      ...sideSwitchAreas('ww-page2', 'ww-page1'),
      // news cards
      area(SIDE_W, 75, 350, 645, open('/#news')),
      area(500, 75, 500, 645, open('/#shop')),
      area(1000, 75, 500, 645, open('/#partners')),
      area(1500, 75, 500, 645, open('/#stores')),
      area(2000, 75, 350, 645, message('常見問題')),
      area(SIDE_W, 750, CONTENT_W, 525, open('/#news'))
    ]
  }
];

function isProjectMenu(menu) {
  const name = String(menu?.name || '');
  return PROJECT_MENU_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function cleanup() {
  try {
    const aliases = await line('GET', '/v2/bot/richmenu/alias/list');
    for (const a of aliases.aliases || []) {
      if (PROJECT_ALIASES.includes(a.richMenuAliasId)) {
        await line('DELETE', `/v2/bot/richmenu/alias/${a.richMenuAliasId}`);
        console.log(`deleted alias ${a.richMenuAliasId}`);
      }
    }
  } catch (err) {
    console.warn(`alias cleanup skipped: ${err.message}`);
  }

  try {
    const list = await line('GET', '/v2/bot/richmenu/list');
    for (const m of list.richmenus || []) {
      if (isProjectMenu(m)) {
        await line('DELETE', `/v2/bot/richmenu/${m.richMenuId}`);
        console.log(`deleted old rich menu ${m.name}`);
      }
    }
  } catch (err) {
    console.warn(`rich menu cleanup skipped: ${err.message}`);
  }
}

async function createMenu(menu) {
  const payload = {
    size: { width: MENU_W, height: MENU_H },
    selected: true,
    name: menu.name,
    chatBarText: menu.chatBarText,
    areas: menu.areas
  };
  const created = await line('POST', '/v2/bot/richmenu', payload);
  const richMenuId = created.richMenuId;
  const image = fs.readFileSync(menu.image);
  await lineData('POST', `/v2/bot/richmenu/${richMenuId}/content`, image, { 'Content-Type': 'image/jpeg' });
  return { ...menu, richMenuId };
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log('同步 Rich Menu V10：建立 2500x1350 三頁，移除上方分頁列，左右邊緣切換頁面。');
  await cleanup();
  const created = [];
  for (const menu of menus) {
    const m = await createMenu(menu);
    created.push(m);
    console.log(`created menu ${m.name}: ${m.richMenuId}`);
  }
  for (const m of created) {
    await line('POST', '/v2/bot/richmenu/alias', { richMenuAliasId: m.alias, richMenuId: m.richMenuId });
    console.log(`created alias ${m.alias}: ${m.richMenuId}`);
  }
  const page1 = created.find((m) => m.alias === 'ww-page1');
  await line('POST', `/v2/bot/user/all/richmenu/${page1.richMenuId}`);
  console.log(`default rich menu set: ${page1.richMenuId}`);
  console.log(JSON.stringify(created.map(({ alias, richMenuId, name }) => ({ alias, richMenuId, name })), null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
