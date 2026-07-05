import dotenv from 'dotenv';
dotenv.config();
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) {
  console.error('缺少 LINE_CHANNEL_ACCESS_TOKEN');
  process.exit(1);
}
const apiBase = 'https://api.line.me';
async function line(method, endpoint) {
  const res = await fetch(`${apiBase}${endpoint}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} failed ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}
async function main() {
  try {
    await line('DELETE', '/v2/bot/user/all/richmenu');
    console.log('default rich menu unlinked');
  } catch (err) { console.warn(`default unlink skipped: ${err.message}`); }
  try {
    const aliases = await line('GET', '/v2/bot/richmenu/alias/list');
    for (const a of aliases.aliases || []) {
      if (['ww-main', 'ww-page1', 'ww-page2', 'ww-page3'].includes(a.richMenuAliasId)) {
        await line('DELETE', `/v2/bot/richmenu/alias/${a.richMenuAliasId}`);
        console.log(`deleted alias ${a.richMenuAliasId}`);
      }
    }
  } catch (err) { console.warn(`alias delete skipped: ${err.message}`); }
  const list = await line('GET', '/v2/bot/richmenu/list');
  for (const m of list.richmenus || []) {
    const name = String(m.name || '');
    if (name.startsWith('WW Beyblade V7') || name.startsWith('WW Beyblade V8')) {
      await line('DELETE', `/v2/bot/richmenu/${m.richMenuId}`);
      console.log(`deleted ${name}`);
    }
  }
}
main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
