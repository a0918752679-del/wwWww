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

async function line(method, endpoint, body, extraHeaders = {}) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    method,
    headers: headers(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json', ...extraHeaders } : extraHeaders),
    body: body ? (body instanceof Buffer ? body : JSON.stringify(body)) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${endpoint} failed ${res.status}: ${text}`);
  return data;
}

function area(x, y, width, height, action) {
  return { bounds: { x, y, width, height }, action };
}

const open = (pathname) => ({ type: 'uri', uri: uri(pathname) });

const menu = {
  alias: 'ww-main',
  name: 'WW Beyblade V8 Main Rich Menu',
  image: path.join(root, 'public/assets/richmenu/main.jpg'),
  chatBarText: '萬萬沒想到',
  areas: [
    area(0, 420, 833, 423, open('/#shop')),       // 立即刮刮樂
    area(833, 420, 834, 423, open('/#odds')),     // 最新賠率
    area(1667, 420, 833, 423, open('/#events'))   // 最新活動
  ]
};

async function cleanup() {
  try {
    const aliases = await line('GET', '/v2/bot/richmenu/alias/list');
    for (const a of aliases.aliases || []) {
      if (['ww-main', 'ww-page1', 'ww-page2', 'ww-page3'].includes(a.richMenuAliasId)) {
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
      const name = String(m.name || '');
      if (name.startsWith('WW Beyblade V7') || name.startsWith('WW Beyblade V8')) {
        await line('DELETE', `/v2/bot/richmenu/${m.richMenuId}`);
        console.log(`deleted old rich menu ${name}`);
      }
    }
  } catch (err) {
    console.warn(`rich menu cleanup skipped: ${err.message}`);
  }
}

async function createMenu() {
  if (!fs.existsSync(menu.image)) throw new Error(`找不到 Rich Menu 圖檔：${menu.image}`);
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
  await line('POST', `/v2/bot/richmenu/${richMenuId}/content`, image, { 'Content-Type': 'image/jpeg' });
  await line('POST', '/v2/bot/richmenu/alias', { richMenuAliasId: menu.alias, richMenuId });
  return { ...menu, richMenuId };
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);
  console.log('同步 Rich Menu：刪除舊三頁版本，建立單頁三功能版本，並設定為預設選單。');
  await cleanup();
  const created = await createMenu();
  await line('POST', `/v2/bot/user/all/richmenu/${created.richMenuId}`);
  console.log(`default rich menu set: ${created.richMenuId}`);
  console.log(JSON.stringify({ alias: created.alias, richMenuId: created.richMenuId, name: created.name, image: 'public/assets/richmenu/main.jpg' }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
