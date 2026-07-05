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
const PROJECT_MENU_PREFIXES = ['WW Beyblade V7', 'WW Beyblade V8'];
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

// LINE compact Rich Menu 固定支援 2500x843，不能再做成更矮。
// 本版將底部 3 個分頁切換區做成可見按鈕，避免使用者點不到隱藏切換區。
const NAV_Y = 680;
const NAV_H = 163;
const TAB_W = 833;
const menus = [
  {
    key: 'page1',
    alias: 'ww-page1',
    name: 'WW Beyblade V8 Page 1 Home',
    image: path.join(root, 'public/assets/richmenu/page1.jpg'),
    chatBarText: '首頁',
    areas: [
      area(0, 250, 833, 190, open('/#pools')),
      area(833, 250, 834, 190, open('/#shop')),
      area(1667, 250, 833, 190, switchTo('ww-page2', 'go-records')),
      area(0, 445, 625, 185, open('/#rules')),
      area(625, 445, 625, 185, open('/#member')),
      area(1250, 445, 625, 185, message('客服')),
      area(1875, 445, 625, 185, switchTo('ww-page3', 'go-news')),
      area(0, NAV_Y, TAB_W, NAV_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_W, NAV_Y, 834, NAV_H, switchTo('ww-page2', 'tab-records')),
      area(1667, NAV_Y, TAB_W, NAV_H, switchTo('ww-page3', 'tab-news'))
    ]
  },
  {
    key: 'page2',
    alias: 'ww-page2',
    name: 'WW Beyblade V8 Page 2 Records',
    image: path.join(root, 'public/assets/richmenu/page2.jpg'),
    chatBarText: '我的紀錄',
    areas: [
      area(0, 120, 625, 380, open('/#draws')),
      area(625, 120, 625, 380, open('/#history')),
      area(1250, 120, 625, 380, open('/#shipping')),
      area(1875, 120, 625, 380, open('/#wallet')),
      area(0, NAV_Y, TAB_W, NAV_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_W, NAV_Y, 834, NAV_H, switchTo('ww-page2', 'tab-records')),
      area(1667, NAV_Y, TAB_W, NAV_H, switchTo('ww-page3', 'tab-news'))
    ]
  },
  {
    key: 'page3',
    alias: 'ww-page3',
    name: 'WW Beyblade V8 Page 3 News',
    image: path.join(root, 'public/assets/richmenu/page3.jpg'),
    chatBarText: '最新消息',
    areas: [
      area(0, 90, 500, 335, open('/#news')),
      area(500, 90, 500, 335, open('/#shop')),
      area(1000, 90, 500, 335, open('/#partners')),
      area(1500, 90, 500, 335, open('/#stores')),
      area(2000, 90, 500, 335, message('常見問題')),
      area(0, NAV_Y, TAB_W, NAV_H, switchTo('ww-page1', 'tab-home')),
      area(TAB_W, NAV_Y, 834, NAV_H, switchTo('ww-page2', 'tab-records')),
      area(1667, NAV_Y, TAB_W, NAV_H, switchTo('ww-page3', 'tab-news'))
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
    size: { width: 2500, height: 843 },
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
  console.log('同步 Rich Menu：建立三頁、上傳圖片、建立 alias、設定 page1 為 default。');
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
