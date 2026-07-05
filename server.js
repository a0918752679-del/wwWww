import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 8080);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '69677323';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const COOKIE_SECURE = BASE_URL.startsWith('https://');

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || '';
const GOOGLE_SHEET_TAB_ACCOUNTING = process.env.GOOGLE_SHEET_TAB_ACCOUNTING || '消費匯款紀錄';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const PRODUCT_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'products');
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function ensureProductUploadDir() {
  if (!fs.existsSync(PRODUCT_UPLOAD_DIR)) fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
}

function safeImageExt(mime, filename = '') {
  const fromMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[mime];
  if (fromMime) return fromMime;
  const ext = path.extname(String(filename || '').toLowerCase());
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
}

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function now() {
  return new Date().toISOString();
}

function ensureDbShape(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.products = Array.isArray(db.products) ? db.products : [];
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.accounting = Array.isArray(db.accounting) ? db.accounting : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];
  return db;
}

function accountingLabel(record) {
  return {
    sales_order: '客戶消費紀錄',
    bank_transfer: '匯款入帳紀錄',
    refund: '退款紀錄',
    expense: '支出紀錄',
    adjustment: '調整紀錄',
    income: '收入紀錄'
  }[record.type] || record.type || '紀錄';
}

function makeAccountingRecord(payload = {}) {
  const amount = Number(payload.amount || 0);
  return {
    id: payload.id || id('acc'),
    type: String(payload.type || 'sales_order'),
    status: String(payload.status || 'draft'),
    source: String(payload.source || 'manual'),
    orderId: String(payload.orderId || ''),
    paymentId: String(payload.paymentId || ''),
    userId: String(payload.userId || ''),
    customerName: String(payload.customerName || payload.userName || '').trim(),
    customerEmail: String(payload.customerEmail || payload.userEmail || '').trim(),
    customerPhone: String(payload.customerPhone || '').trim(),
    itemSummary: String(payload.itemSummary || '').trim(),
    amount,
    method: String(payload.method || payload.paymentMethod || '').trim(),
    bankLast5: String(payload.bankLast5 || '').trim(),
    transferDate: String(payload.transferDate || '').trim(),
    note: String(payload.note || '').trim(),
    createdAt: payload.createdAt || now(),
    updatedAt: now(),
    sheetSyncedAt: payload.sheetSyncedAt || '',
    sheetSyncStatus: payload.sheetSyncStatus || 'not_synced',
    sheetError: payload.sheetError || ''
  };
}

function accountingRow(record) {
  return [
    record.createdAt || '',
    record.updatedAt || '',
    record.id || '',
    accountingLabel(record),
    record.type || '',
    record.status || '',
    record.source || '',
    record.orderId || '',
    record.paymentId || '',
    record.customerName || '',
    record.customerEmail || '',
    record.customerPhone || '',
    record.itemSummary || '',
    Number(record.amount || 0),
    record.method || '',
    record.transferDate || '',
    record.bankLast5 || '',
    record.note || ''
  ];
}

function googleSheetsReady() {
  return Boolean(GOOGLE_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY);
}

function base64Url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  if (!googleSheetsReady()) throw new Error('尚未設定 Google Sheets 環境變數');
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600,
    iat
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), GOOGLE_PRIVATE_KEY);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error_description || data.error || 'Google OAuth token failed');
  return data.access_token;
}

async function appendAccountingToSheet(records) {
  const rows = records.map(accountingRow);
  if (!rows.length) return { updatedRows: 0 };
  const token = await getGoogleAccessToken();
  const range = `${encodeURIComponent(GOOGLE_SHEET_TAB_ACCOUNTING)}!A:R`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error?.message || data.error || 'Google Sheet 寫入失敗');
  return data.updates || data;
}

function orderItemSummary(order) {
  return (order.items || []).map((i) => `${i.title}×${i.qty}`).join('、');
}

async function syncAccountingRecords(db, records) {
  if (!googleSheetsReady()) throw new Error('尚未設定 Google Sheets 環境變數');
  await appendAccountingToSheet(records);
  const syncedAt = now();
  for (const record of records) {
    record.sheetSyncedAt = syncedAt;
    record.sheetSyncStatus = 'synced';
    record.sheetError = '';
    record.updatedAt = syncedAt;
  }
  log(db, '同步記帳資料至 Google Sheet', { count: records.length }, 'admin');
  return { count: records.length, syncedAt };
}

function ensureDbFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(path.join(__dirname, 'data', 'db.seed.json'), DATA_FILE);
  }
}

function readDb() {
  ensureDbFile();
  return ensureDbShape(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
}

function writeDb(db) {
  ensureDbFile();
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'scripts', scriptName)], {
      cwd: __dirname,
      env: process.env,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 4
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function lineApi(method, endpoint, body) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('缺少 LINE_CHANNEL_ACCESS_TOKEN');
  const res = await fetch(`https://api.line.me${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${endpoint} failed ${res.status}: ${text}`);
  return data;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function signUser(user) {
  return jwt.sign({ sub: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '14d' });
}

function setUserCookie(res, user) {
  res.cookie('ww_session', signUser(user), {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000
  });
}

function setAdminCookie(res) {
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('ww_admin', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });
}

function getUserFromReq(req) {
  const token = req.cookies?.ww_session;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDb();
    return db.users.find((u) => u.id === payload.sub) || null;
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: '請先登入會員' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.ww_admin;
  if (!token) return res.status(401).json({ error: '請先登入後台' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch {
    return res.status(401).json({ error: '後台登入逾時，請重新登入' });
  }
}

function log(db, action, detail = {}, actor = 'system') {
  db.logs.unshift({ id: id('log'), at: now(), actor, action, detail });
  db.logs = db.logs.slice(0, 500);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function upsertOAuthUser({ provider, providerId, email, name, avatar, lineUserId }) {
  const db = readDb();
  const mail = normalizeEmail(email);
  let user = db.users.find((u) => u.provider === provider && u.providerId === providerId);
  if (!user && mail) user = db.users.find((u) => normalizeEmail(u.email) === mail);
  if (!user) {
    user = {
      id: id('usr'),
      provider,
      providerId,
      email: mail || '',
      name: name || `${provider} 會員`,
      phone: '',
      avatar: avatar || '',
      lineUserId: lineUserId || '',
      points: 0,
      createdAt: now(),
      updatedAt: now()
    };
    db.users.unshift(user);
    log(db, '會員建立', { provider, email: mail, userId: user.id }, user.id);
  } else {
    user.provider = user.provider || provider;
    user.providerId = user.providerId || providerId;
    user.email = user.email || mail;
    user.name = name || user.name;
    user.avatar = avatar || user.avatar;
    user.lineUserId = lineUserId || user.lineUserId;
    user.updatedAt = now();
    log(db, '會員登入', { provider, userId: user.id }, user.id);
  }
  writeDb(db);
  return user;
}

function oauthState(res, provider) {
  const state = `${provider}_${crypto.randomBytes(16).toString('hex')}`;
  res.cookie(`oauth_${provider}`, state, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });
  return state;
}

function verifyOauthState(req, res, provider) {
  const expected = req.cookies?.[`oauth_${provider}`];
  const actual = req.query?.state || req.body?.state;
  res.clearCookie(`oauth_${provider}`);
  return expected && actual && expected === actual;
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return {};
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function redirectWithError(res, message) {
  res.redirect(`/login-error.html?message=${encodeURIComponent(message)}`);
}

function activeProduct(product) {
  return product.status === 'active' && Number(product.stock) > 0;
}

function recalcProductStatus(product) {
  product.stock = Number(product.stock || 0);
  if (product.stock <= 0) {
    product.stock = 0;
    product.status = 'soldout';
  }
  product.updatedAt = now();
  return product;
}

// ---------- Public config ----------
app.get('/api/config', (_req, res) => {
  res.json({
    baseUrl: BASE_URL,
    bankAccount: process.env.BANK_ACCOUNT || '請於 Zeabur 設定 BANK_ACCOUNT',
    features: {
      lineLogin: Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET),
      googleLogin: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      bankTransfer: true
    }
  });
});

// ---------- Auth: local account ----------
app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: '姓名、Email 必填，密碼至少 6 碼' });
  }

  const db = readDb();
  if (db.users.some((u) => normalizeEmail(u.email) === email)) {
    return res.status(409).json({ error: '此 Email 已註冊，請直接登入' });
  }

  const user = {
    id: id('usr'),
    provider: 'local',
    providerId: email,
    email,
    name,
    phone,
    avatar: '',
    points: 0,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: now(),
    updatedAt: now()
  };
  db.users.unshift(user);
  log(db, '自主會員註冊', { userId: user.id, email }, user.id);
  writeDb(db);
  setUserCookie(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const db = readDb();
  const user = db.users.find((u) => normalizeEmail(u.email) === email && u.provider === 'local');
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }
  user.updatedAt = now();
  log(db, '自主會員登入', { userId: user.id, email }, user.id);
  writeDb(db);
  setUserCookie(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('ww_session');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: publicUser(getUserFromReq(req)) });
});

// ---------- Auth: Google OAuth ----------
app.get('/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectWithError(res, '尚未設定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  }
  const state = oauthState(res, 'google');
  const redirectUri = `${BASE_URL}/auth/google/callback`;
  const qs = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    if (!verifyOauthState(req, res, 'google')) return redirectWithError(res, 'Google 登入 state 驗證失敗');
    const code = String(req.query.code || '');
    if (!code) return redirectWithError(res, 'Google 未回傳授權碼');

    const redirectUri = `${BASE_URL}/auth/google/callback`;
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const token = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(token.error_description || token.error || 'Google token exchange failed');

    const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileResp.json();
    if (!profileResp.ok) throw new Error(profile.error_description || 'Google profile failed');

    const user = upsertOAuthUser({
      provider: 'google',
      providerId: profile.sub,
      email: profile.email,
      name: profile.name,
      avatar: profile.picture
    });
    setUserCookie(res, user);
    res.redirect('/?login=google');
  } catch (err) {
    redirectWithError(res, `Google 登入失敗：${err.message}`);
  }
});

// ---------- Auth: LINE OAuth ----------
app.get('/auth/line', (req, res) => {
  if (!process.env.LINE_LOGIN_CHANNEL_ID || !process.env.LINE_LOGIN_CHANNEL_SECRET) {
    return redirectWithError(res, '尚未設定 LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET');
  }
  const state = oauthState(res, 'line');
  const redirectUri = `${BASE_URL}/auth/line/callback`;
  const qs = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_LOGIN_CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid email'
  });
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${qs.toString()}`);
});

app.get('/auth/line/callback', async (req, res) => {
  try {
    if (!verifyOauthState(req, res, 'line')) return redirectWithError(res, 'LINE 登入 state 驗證失敗');
    const code = String(req.query.code || '');
    if (!code) return redirectWithError(res, 'LINE 未回傳授權碼');

    const redirectUri = `${BASE_URL}/auth/line/callback`;
    const tokenResp = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET
      })
    });
    const token = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(token.error_description || token.error || 'LINE token exchange failed');

    const profileResp = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileResp.json();
    if (!profileResp.ok) throw new Error(profile.message || 'LINE profile failed');

    const idPayload = decodeJwtPayload(token.id_token);
    const user = upsertOAuthUser({
      provider: 'line',
      providerId: profile.userId,
      email: idPayload.email || '',
      name: profile.displayName,
      avatar: profile.pictureUrl,
      lineUserId: profile.userId
    });
    setUserCookie(res, user);
    res.redirect('/?login=line');
  } catch (err) {
    redirectWithError(res, `LINE 登入失敗：${err.message}`);
  }
});

// ---------- Customer: products/orders ----------
app.get('/api/products', (_req, res) => {
  const db = readDb();
  res.json({ products: db.products.filter((p) => p.status === 'active' || p.status === 'soldout') });
});

app.get('/api/orders/mine', requireUser, (req, res) => {
  const db = readDb();
  const orders = db.orders.filter((o) => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders });
});

app.post('/api/orders', requireUser, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const bank = req.body.bank || {};
  if (!items.length) return res.status(400).json({ error: '購物車是空的' });

  const db = readDb();
  const orderItems = [];
  let total = 0;

  for (const item of items) {
    const productId = String(item.productId || '');
    const qty = Math.max(1, Math.floor(Number(item.qty || 1)));
    const product = db.products.find((p) => p.id === productId);
    if (!product || !activeProduct(product)) {
      return res.status(400).json({ error: `商品已下架或售完：${product?.title || productId}` });
    }
    if (Number(product.stock) < qty) {
      return res.status(400).json({ error: `庫存不足：${product.title}，目前剩 ${product.stock}` });
    }
    orderItems.push({
      productId: product.id,
      title: product.title,
      price: Number(product.price),
      qty,
      subtotal: Number(product.price) * qty,
      imageUrl: product.imageUrl
    });
    total += Number(product.price) * qty;
  }

  // Bank transfer mode: reserve inventory immediately to prevent overselling.
  for (const item of orderItems) {
    const product = db.products.find((p) => p.id === item.productId);
    product.stock = Number(product.stock) - item.qty;
    recalcProductStatus(product);
  }

  const order = {
    id: id('ord'),
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    items: orderItems,
    total,
    status: 'pending_bank',
    paymentMethod: 'bank_transfer',
    bankLast5: String(bank.bankLast5 || '').trim(),
    transferDate: String(bank.transferDate || '').trim(),
    transferAmount: Number(bank.transferAmount || total),
    note: String(bank.note || '').trim(),
    createdAt: now(),
    updatedAt: now()
  };
  const payment = {
    id: id('pay'),
    orderId: order.id,
    userId: req.user.id,
    amount: total,
    method: 'bank_transfer',
    status: 'pending_review',
    bankLast5: order.bankLast5,
    transferDate: order.transferDate,
    transferAmount: order.transferAmount,
    createdAt: now(),
    updatedAt: now()
  };
  db.orders.unshift(order);
  db.payments.unshift(payment);
  db.accounting.unshift(makeAccountingRecord({
    type: 'sales_order',
    status: 'pending_bank',
    source: 'checkout',
    orderId: order.id,
    paymentId: payment.id,
    userId: order.userId,
    customerName: order.userName,
    customerEmail: order.userEmail,
    itemSummary: orderItemSummary(order),
    amount: order.total,
    method: 'bank_transfer',
    bankLast5: order.bankLast5,
    transferDate: order.transferDate,
    note: order.note
  }));
  log(db, '建立銀行匯款訂單並保留庫存', { orderId: order.id, total }, req.user.id);
  writeDb(db);
  res.json({ order, payment });
});

// ---------- Admin ----------
app.post('/api/admin/login', async (req, res) => {
  const password = String(req.body.password || '');
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '後台密碼錯誤' });
  setAdminCookie(res);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('ww_admin');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ admin: true }));

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = db.orders.filter((o) => o.createdAt?.slice(0, 10) === today);
  const pending = db.orders.filter((o) => o.status === 'pending_bank');
  const paidOrders = db.orders.filter((o) => o.status === 'paid');
  res.json({
    stats: {
      users: db.users.length,
      products: db.products.length,
      activeProducts: db.products.filter((p) => p.status === 'active').length,
      soldoutProducts: db.products.filter((p) => p.status === 'soldout').length,
      pendingPayments: pending.length,
      todayOrders: todayOrders.length,
      todayRevenue: todayOrders.filter((o) => o.status === 'paid').reduce((s, o) => s + Number(o.total || 0), 0),
      totalRevenue: paidOrders.reduce((s, o) => s + Number(o.total || 0), 0)
    },
    recentOrders: db.orders.slice(0, 20),
    lowStock: db.products.filter((p) => p.status === 'active' && Number(p.stock) <= 5).slice(0, 20),
    logs: db.logs.slice(0, 20)
  });
});


app.post('/api/admin/uploads/product-image', requireAdmin, (req, res) => {
  const { filename = 'product-image', dataUrl = '' } = req.body || {};
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return res.status(400).json({ error: '圖片格式錯誤，請重新選擇檔案' });

  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) return res.status(400).json({ error: '僅支援 JPG、PNG、WEBP、GIF 圖片' });

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) return res.status(400).json({ error: '圖片內容為空' });
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: '圖片不可超過 5MB' });

  ensureProductUploadDir();
  const ext = safeImageExt(mime, filename);
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const absPath = path.join(PRODUCT_UPLOAD_DIR, storedName);
  fs.writeFileSync(absPath, buffer);

  const imageUrl = `/uploads/products/${storedName}`;
  const db = readDb();
  log(db, '上傳商品圖片', { filename: String(filename), imageUrl }, 'admin');
  writeDb(db);
  res.json({ imageUrl });
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({ products: db.products });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const payload = req.body || {};
  const title = String(payload.title || '').trim();
  const price = Number(payload.price || 0);
  if (!title || price <= 0) return res.status(400).json({ error: '商品名稱與售價必填' });

  const db = readDb();
  const product = recalcProductStatus({
    id: id('prd'),
    title,
    category: String(payload.category || '戰鬥陀螺').trim(),
    price,
    stock: Math.max(0, Math.floor(Number(payload.stock || 0))),
    status: String(payload.status || 'draft'),
    imageUrl: String(payload.imageUrl || '/assets/products/placeholder.svg').trim(),
    description: String(payload.description || '').trim(),
    createdAt: now(),
    updatedAt: now()
  });
  db.products.unshift(product);
  log(db, '新增商品', { productId: product.id, title: product.title }, 'admin');
  writeDb(db);
  res.json({ product });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: '找不到商品' });
  const payload = req.body || {};
  if (payload.title !== undefined) product.title = String(payload.title).trim();
  if (payload.category !== undefined) product.category = String(payload.category).trim();
  if (payload.price !== undefined) product.price = Number(payload.price || 0);
  if (payload.stock !== undefined) product.stock = Math.max(0, Math.floor(Number(payload.stock || 0)));
  if (payload.status !== undefined) product.status = String(payload.status);
  if (payload.imageUrl !== undefined) product.imageUrl = String(payload.imageUrl).trim();
  if (payload.description !== undefined) product.description = String(payload.description).trim();
  recalcProductStatus(product);
  if (payload.status === 'draft' || payload.status === 'archived') product.status = payload.status;
  if (payload.status === 'active' && product.stock > 0) product.status = 'active';
  log(db, '更新商品', { productId: product.id, title: product.title, status: product.status }, 'admin');
  writeDb(db);
  res.json({ product });
});

app.post('/api/admin/products/:id/publish', requireAdmin, (req, res) => {
  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: '找不到商品' });
  if (Number(product.stock) <= 0) return res.status(400).json({ error: '庫存為 0，不能上架' });
  product.status = 'active';
  product.updatedAt = now();
  log(db, '商品上架', { productId: product.id, title: product.title }, 'admin');
  writeDb(db);
  res.json({ product });
});

app.post('/api/admin/products/:id/unpublish', requireAdmin, (req, res) => {
  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: '找不到商品' });
  product.status = 'draft';
  product.updatedAt = now();
  log(db, '商品下架', { productId: product.id, title: product.title }, 'admin');
  writeDb(db);
  res.json({ product });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({ orders: db.orders, payments: db.payments });
});


app.get('/api/admin/accounting', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({
    records: db.accounting,
    sheet: {
      enabled: googleSheetsReady(),
      sheetId: GOOGLE_SHEET_ID || '',
      tab: GOOGLE_SHEET_TAB_ACCOUNTING,
      missing: [
        !GOOGLE_SHEET_ID ? 'GOOGLE_SHEET_ID' : '',
        !GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL' : '',
        !GOOGLE_PRIVATE_KEY ? 'GOOGLE_PRIVATE_KEY' : ''
      ].filter(Boolean)
    }
  });
});

app.post('/api/admin/accounting', requireAdmin, (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);
  if (!payload.type) return res.status(400).json({ error: '請選擇紀錄類型' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  const db = readDb();
  const record = makeAccountingRecord({
    type: payload.type,
    status: payload.status || 'confirmed',
    source: 'manual',
    orderId: payload.orderId,
    paymentId: payload.paymentId,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
    itemSummary: payload.itemSummary,
    amount,
    method: payload.method,
    bankLast5: payload.bankLast5,
    transferDate: payload.transferDate,
    note: payload.note
  });
  db.accounting.unshift(record);
  log(db, '新增記帳紀錄', { recordId: record.id, type: record.type, amount: record.amount }, 'admin');
  writeDb(db);
  res.json({ record });
});

app.put('/api/admin/accounting/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const record = db.accounting.find((r) => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: '找不到記帳紀錄' });
  const fields = ['type','status','orderId','paymentId','customerName','customerEmail','customerPhone','itemSummary','method','bankLast5','transferDate','note'];
  for (const f of fields) if (req.body[f] !== undefined) record[f] = String(req.body[f] || '').trim();
  if (req.body.amount !== undefined) record.amount = Number(req.body.amount || 0);
  if (!Number.isFinite(record.amount) || record.amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  record.updatedAt = now();
  record.sheetSyncStatus = record.sheetSyncedAt ? 'needs_resync' : record.sheetSyncStatus;
  log(db, '更新記帳紀錄', { recordId: record.id, amount: record.amount }, 'admin');
  writeDb(db);
  res.json({ record });
});

app.post('/api/admin/accounting/:id/sync', requireAdmin, async (req, res) => {
  const db = readDb();
  const record = db.accounting.find((r) => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: '找不到記帳紀錄' });
  try {
    const result = await syncAccountingRecords(db, [record]);
    writeDb(db);
    res.json({ ok: true, result, record });
  } catch (err) {
    record.sheetSyncStatus = 'failed';
    record.sheetError = err.message;
    record.updatedAt = now();
    writeDb(db);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/accounting/sync-all', requireAdmin, async (_req, res) => {
  const db = readDb();
  const records = db.accounting.filter((r) => r.sheetSyncStatus !== 'synced');
  if (!records.length) return res.json({ ok: true, result: { count: 0 } });
  try {
    const result = await syncAccountingRecords(db, records);
    writeDb(db);
    res.json({ ok: true, result });
  } catch (err) {
    const failedAt = now();
    for (const record of records) {
      record.sheetSyncStatus = 'failed';
      record.sheetError = err.message;
      record.updatedAt = failedAt;
    }
    writeDb(db);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/accounting/export.csv', requireAdmin, (_req, res) => {
  const db = readDb();
  const header = ['建立時間','更新時間','紀錄ID','類型','type','狀態','來源','訂單ID','付款ID','客戶姓名','Email','電話','商品/項目','金額','付款方式','匯款日期','帳號末五碼','備註'];
  const rows = [header, ...db.accounting.map(accountingRow)];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="accounting.csv"');
  res.send(`\ufeff${csv}`);
});

app.post('/api/admin/orders/:id/confirm-payment', requireAdmin, (req, res) => {
  const db = readDb();
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: '找不到訂單' });
  if (order.status === 'paid') return res.json({ order });
  if (order.status !== 'pending_bank') return res.status(400).json({ error: `訂單狀態不可確認：${order.status}` });
  order.status = 'paid';
  order.confirmedAt = now();
  order.updatedAt = now();
  const payment = db.payments.find((p) => p.orderId === order.id);
  if (payment) {
    payment.status = 'paid';
    payment.confirmedAt = now();
    payment.updatedAt = now();
  }
  const existingOrderRecord = db.accounting.find((a) => a.orderId === order.id && a.type === 'sales_order');
  if (existingOrderRecord) {
    existingOrderRecord.status = 'paid';
    existingOrderRecord.updatedAt = now();
    existingOrderRecord.sheetSyncStatus = existingOrderRecord.sheetSyncedAt ? 'needs_resync' : existingOrderRecord.sheetSyncStatus;
  }
  db.accounting.unshift(makeAccountingRecord({
    type: 'bank_transfer',
    status: 'paid',
    source: 'bank_transfer_confirmed',
    orderId: order.id,
    paymentId: payment?.id || '',
    userId: order.userId,
    customerName: order.userName,
    customerEmail: order.userEmail,
    itemSummary: orderItemSummary(order),
    amount: order.total,
    method: 'bank_transfer',
    bankLast5: order.bankLast5,
    transferDate: order.transferDate,
    note: `銀行匯款確認：${order.userName}`
  }));
  log(db, '確認銀行匯款', { orderId: order.id, total: order.total }, 'admin');
  writeDb(db);
  res.json({ order });
});

app.post('/api/admin/orders/:id/cancel', requireAdmin, (req, res) => {
  const db = readDb();
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: '找不到訂單' });
  if (order.status === 'paid') return res.status(400).json({ error: '已付款訂單不能用此功能取消' });
  if (order.status === 'cancelled') return res.json({ order });

  // release reserved stock
  for (const item of order.items || []) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product) {
      product.stock = Number(product.stock || 0) + Number(item.qty || 0);
      if (product.status === 'soldout' && product.stock > 0) product.status = 'draft';
      product.updatedAt = now();
    }
  }
  order.status = 'cancelled';
  order.cancelledAt = now();
  order.updatedAt = now();
  const payment = db.payments.find((p) => p.orderId === order.id);
  if (payment) {
    payment.status = 'cancelled';
    payment.updatedAt = now();
  }
  const existingOrderRecord = db.accounting.find((a) => a.orderId === order.id && a.type === 'sales_order');
  if (existingOrderRecord) {
    existingOrderRecord.status = 'cancelled';
    existingOrderRecord.updatedAt = now();
    existingOrderRecord.sheetSyncStatus = existingOrderRecord.sheetSyncedAt ? 'needs_resync' : existingOrderRecord.sheetSyncStatus;
  }
  log(db, '取消訂單並釋放庫存', { orderId: order.id }, 'admin');
  writeDb(db);
  res.json({ order });
});


app.get('/api/admin/line/richmenu/status', requireAdmin, async (_req, res) => {
  try {
    const [menus, aliases] = await Promise.all([
      lineApi('GET', '/v2/bot/richmenu/list'),
      lineApi('GET', '/v2/bot/richmenu/alias/list').catch(() => ({ aliases: [] }))
    ]);
    const wwMenus = (menus.richmenus || []).filter((m) => String(m.name || '').startsWith('WW Beyblade V7'));
    const wwAliases = (aliases.aliases || []).filter((a) => ['ww-page1', 'ww-page2', 'ww-page3'].includes(a.richMenuAliasId));
    res.json({ ok: true, menus: wwMenus, aliases: wwAliases });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/line/richmenu/sync', requireAdmin, async (_req, res) => {
  try {
    const result = await runNodeScript('sync-richmenu.js');
    const db = readDb();
    log(db, '同步 LINE Rich Menu', { stdout: result.stdout.slice(-2000) }, 'admin');
    writeDb(db);
    res.json({ ok: true, stdout: result.stdout, stderr: result.stderr });
  } catch (err) {
    res.status(400).json({ error: err.message, stdout: err.stdout, stderr: err.stderr });
  }
});

app.post('/api/admin/line/richmenu/delete', requireAdmin, async (_req, res) => {
  try {
    const result = await runNodeScript('delete-richmenu.js');
    const db = readDb();
    log(db, '刪除 LINE Rich Menu', { stdout: result.stdout.slice(-2000) }, 'admin');
    writeDb(db);
    res.json({ ok: true, stdout: result.stdout, stderr: result.stderr });
  } catch (err) {
    res.status(400).json({ error: err.message, stdout: err.stdout, stderr: err.stderr });
  }
});

// ---------- Static route fallbacks ----------
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '伺服器錯誤', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
});

app.listen(PORT, () => {
  console.log(`萬萬沒想到 V7 running on ${BASE_URL} port ${PORT}`);
});
