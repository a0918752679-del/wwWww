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

const menus = [
  {
    key: 'page1',
    alias: 'ww-page1',
    name: 'WW Beyblade V7 Page 1 Home',
    image: path.join(root, 'public/assets/richmenu/page1.jpg'),
    chatBarText: '萬萬沒想到',
    areas: [
      // 第一頁：3 大功能 + 4 小功能；我的獎品切到第二頁，最新消息切到第三頁
      area(0, 315, 833, 235, open('/#pools')),
      area(833, 315, 834, 235, open('/#shop')),
      area(1667, 315, 833, 235, switchTo('ww-page2', 'go-records')),
      area(0, 550, 625, 230, open('/#rules')),
      area(625, 550, 625, 230, open('/#member')),
      area(1250, 550, 625, 230, message('客服')),
      area(1875, 550, 625, 230, switchTo('ww-page3', 'go-about')),
      // 底部隱藏導覽帶：左/中/右切頁，方便測試與備援
      area(0, 780, 833, 63, switchTo('ww-page1', 'go-page1')),
      area(833, 780, 834, 63, switchTo('ww-page2', 'go-page2')),
      area(1667, 780, 833, 63, switchTo('ww-page3', 'go-page3'))
    ]
  },
  {
    key: 'page2',
    alias: 'ww-page2',
    name: 'WW Beyblade V7 Page 2 Records',
    image: path.join(root, 'public/assets/richmenu/page2.jpg'),
    chatBarText: '我的紀錄',
    areas: [
      area(0, 145, 625, 470, open('/#draws')),
      area(625, 145, 625, 470, open('/#history')),
      area(1250, 145, 625, 470, open('/#shipping')),
      area(1875, 145, 625, 470, open('/#wallet')),
      area(0, 615, 833, 228, switchTo('ww-page1', 'go-home')),
      area(833, 615, 834, 228, switchTo('ww-page1', 'go-home')),
      area(1667, 615, 833, 228, switchTo('ww-page3', 'go-about'))
    ]
  },
  {
    key: 'page3',
    alias: 'ww-page3',
    name: 'WW Beyblade V7 Page 3 About',
    image: path.join(root, 'public/assets/richmenu/page3.jpg'),
    chatBarText: '關於我們',
    areas: [
      area(0, 105, 500, 415, open('/#news')),
      area(500, 105, 500, 415, open('/#shop')),
      area(1000, 105, 500, 415, open('/#partners')),
      area(1500, 105, 500, 415, open('/#stores')),
      area(2000, 105, 500, 415, message('常見問題')),
      area(0, 520, 833, 240, switchTo('ww-page1', 'go-home')),
      area(833, 520, 834, 240, switchTo('ww-page1', 'go-home')),
      area(1667, 520, 833, 240, switchTo('ww-page1', 'go-home')),
      area(0, 760, 833, 83, switchTo('ww-page1', 'go-page1')),
      area(833, 760, 834, 83, switchTo('ww-page2', 'go-page2')),
      area(1667, 760, 833, 83, switchTo('ww-page3', 'go-page3'))
    ]
  }
];

async function cleanup() {
  // 刪除舊 alias，避免重複建立失敗。
  try {
    const aliases = await line('GET', '/v2/bot/richmenu/alias/list');
    for (const a of aliases.aliases || []) {
      if (['ww-page1', 'ww-page2', 'ww-page3'].includes(a.richMenuAliasId)) {
        await line('DELETE', `/v2/bot/richmenu/alias/${a.richMenuAliasId}`);
        console.log(`deleted alias ${a.richMenuAliasId}`);
      }
    }
  } catch (err) {
    console.warn(`alias cleanup skipped: ${err.message}`);
  }

  // 只刪除本專案建立的 rich menu，避免誤刪其他官方帳號選單。
  try {
    const list = await line('GET', '/v2/bot/richmenu/list');
    for (const m of list.richmenus || []) {
      if (String(m.name || '').startsWith('WW Beyblade V7')) {
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
  await line('POST', '/v2/bot/richmenu/alias', { richMenuAliasId: menu.alias, richMenuId });
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
    console.log(`created ${m.alias}: ${m.richMenuId}`);
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
