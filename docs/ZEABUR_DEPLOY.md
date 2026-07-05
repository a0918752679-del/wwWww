# Zeabur 部署說明

## 1. 上傳 GitHub

把整個專案上傳到 GitHub Repository。

## 2. Zeabur 建立服務

- New Project
- Deploy from GitHub
- 選此 Repository

## 3. Build / Start

```text
Build Command: npm install
Start Command: npm start
```

## 4. Environment Variables

到服務的 Configuration / Variables 新增：

```env
PORT=8080
BASE_URL=https://你的-zeabur-網址
JWT_SECRET=請自行產生長隨機字串
ADMIN_PASSWORD=69677323
BANK_ACCOUNT=你的匯款帳戶資訊
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## 5. 部署後檢查

- `/` 前台是否開啟
- `/admin` 後台是否開啟
- 自主帳號註冊是否成功
- 商品是否可加入購物車
- 匯款訂單是否出現在後台
- 後台是否能確認付款
- 後台是否能上架 / 下架商品

## 6. 常見問題

### 首頁 404

確認 `server.js` 有啟動，且 Start Command 是：

```text
npm start
```

### Google / LINE 登入失敗

檢查三件事：

1. `BASE_URL` 是否是正式網址。
2. 第三方後台 Callback URL 是否完全一致。
3. Channel ID / Secret 是否填到 Zeabur 環境變數。
