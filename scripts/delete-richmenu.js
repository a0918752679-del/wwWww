import dotenv from 'dotenv';
dotenv.config();

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const apiBase = 'https://api.line.me';
const PROJECT_MENU_PREFIXES = ['WW Beyblade V7', 'WW Beyblade V8', 'WW Beyblade V9'];
const PROJECT_ALIASES = ['ww-page1', 'ww-page2', 'ww-page3'];

if (!token) {
  console.error('缺少 LINE_CHANNEL_ACCESS_TOKEN，請先在 Zeabur Variables 設定 Messaging API Channel access token。');
  process.exit(1);
}

async function line(method, endpoint, body) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${endpoint} failed ${res.status}: ${text}`);
  return data;
}

function isProjectMenu(menu) {
  const name = String(menu?.name || '');
  return PROJECT_MENU_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function main() {
  const aliases = await line('GET', '/v2/bot/richmenu/alias/list');
  for (const a of aliases.aliases || []) {
    if (PROJECT_ALIASES.includes(a.richMenuAliasId)) {
      await line('DELETE', `/v2/bot/richmenu/alias/${a.richMenuAliasId}`);
      console.log(`deleted alias ${a.richMenuAliasId}`);
    }
  }

  const list = await line('GET', '/v2/bot/richmenu/list');
  for (const m of list.richmenus || []) {
    if (isProjectMenu(m)) {
      await line('DELETE', `/v2/bot/richmenu/${m.richMenuId}`);
      console.log(`deleted rich menu ${m.name}: ${m.richMenuId}`);
    }
  }
  console.log('done');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
