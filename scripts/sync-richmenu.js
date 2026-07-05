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
const PROJECT_MENU_PREFIXES = ['WW Beyblade V7', 'WW Beyblade V8', 'WW Beyblade V9'];
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

// V9 改為 2500x1150，移除 V8 底部三分頁導覽，避免與 LINE 原生收合列重疊。
// 分頁切換改放在畫面上方三個按鈕，點擊區與視覺按鈕一致。
const MENU_W = 2500;
const MENU_H = 1150;
const TAB_Y = 50;
const TAB_H = 110;
const TAB_X1 = 1260;
const TAB_X2 = 1665;
const TAB_X3 = 2070;
const TAB_W = 360;

const menus = [
  {
    key: 'page1',
    alias: 'ww-page1',
    name: 'WW Beyblade V9 Page 1 Home',
    image: path.join(root, 'public/assets/richmenu/page1.jpg'),
    chatBarText: '選單',
    areas: [
      // top tabs
      area(TAB_X1, TAB_Y, TAB_W, TAB_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_X2, TAB_Y, TAB_W, TAB_H, switchTo('ww-page2', 'tab-records')),
      area(TAB_X3, TAB_Y, TAB_W, TAB_H, switchTo('ww-page3', 'tab-news')),
      // main cards
      area(0, 330, 833, 310, open('/#pools')),
      area(833, 330, 834, 310, open('/#shop')),
      area(1667, 330, 833, 310, switchTo('ww-page2', 'go-records')),
      area(0, 660, 625, 315, open('/#rules')),
      area(625, 660, 625, 315, open('/#member')),
      area(1250, 660, 625, 315, message('客服')),
      area(1875, 660, 625, 315, switchTo('ww-page3', 'go-news'))
    ]
  },
  {
    key: 'page2',
    alias: 'ww-page2',
    name: 'WW Beyblade V9 Page 2 Records',
    image: path.join(root, 'public/assets/richmenu/page2.jpg'),
    chatBarText: '選單',
    areas: [
      // top tabs
      area(TAB_X1, TAB_Y, TAB_W, TAB_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_X2, TAB_Y, TAB_W, TAB_H, switchTo('ww-page2', 'tab-records')),
      area(TAB_X3, TAB_Y, TAB_W, TAB_H, switchTo('ww-page3', 'tab-news')),
      // record cards
      area(0, 300, 625, 540, open('/#draws')),
      area(625, 300, 625, 540, open('/#history')),
      area(1250, 300, 625, 540, open('/#shipping')),
      area(1875, 300, 625, 540, open('/#wallet')),
      area(0, 870, 2500, 250, open('/#member'))
    ]
  },
  {
    key: 'page3',
    alias: 'ww-page3',
    name: 'WW Beyblade V9 Page 3 News',
    image: path.join(root, 'public/assets/richmenu/page3.jpg'),
    chatBarText: '選單',
    areas: [
      // top tabs
      area(TAB_X1, TAB_Y, TAB_W, TAB_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_X2, TAB_Y, TAB_W, TAB_H, switchTo('ww-page2', 'tab-records')),
      area(TAB_X3, TAB_Y, TAB_W, TAB_H, switchTo('ww-page3', 'tab-news')),
      // news cards
      area(0, 300, 500, 430, open('/#news')),
      area(500, 300, 500, 430, open('/#shop')),
      area(1000, 300, 500, 430, open('/#partners')),
      area(1500, 300, 500, 430, open('/#stores')),
      area(2000, 300, 500, 430, message('常見問題')),
      area(0, 750, 2500, 350, open('/#news'))
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
  console.log('同步 Rich Menu V9：建立 2500x1150 三頁、上傳圖片、建立 alias、設定 page1 為 default。');
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
