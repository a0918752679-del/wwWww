# 萬萬沒想到｜戰鬥陀螺線上刮刮樂 V8.1

Zeabur 可部署版。此版重點：

- 單張新版 LINE Rich Menu，三個功能：立即刮刮樂、最新賠率、最新活動
- 已移除舊版三頁 Rich Menu 圖檔
- 後台可一鍵同步 LINE Rich Menu
- 後台可上傳「最新賠率」圖片，並記錄上傳日期時間、原始檔名、備註
- 前台可查看最新賠率圖片
- LINE Login、Google Login、自主帳號登入入口
- 銀行匯款、後台人工確認付款
- 商品新增、編輯、上架、下架、庫存管理
- 商品 Sold Out 防呆

## Zeabur 部署

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

## 重要路徑

```text
/                         前台
/admin                    後台
/auth/line                LINE Login
/auth/google              Google Login
/api/health               健康檢查
/api/config               前台設定
/api/odds/latest          最新賠率資料
```

## 後台

```text
https://你的Zeabur網址/admin
```

預設密碼：

```text
69677323
```

可透過環境參數 `ADMIN_PASSWORD` 修改。

## Rich Menu 檔案

本版只保留單張新版 Rich Menu：

```text
public/assets/richmenu/main.jpg
```

圖片規格：

```text
2500 x 843 px
JPEG
```

對應功能：

| 區塊 | 功能 | 連結 |
|---|---|---|
| 左側 1/3 | 立即刮刮樂 | `/#shop` |
| 中間 1/3 | 最新賠率 | `/#odds` |
| 右側 1/3 | 最新活動 | `/#events` |

## Rich Menu 同步方式

### 後台同步

進入：

```text
/admin → Rich Menu → 一鍵同步 Rich Menu
```

同步會：

1. 刪除本專案舊版 `ww-page1`、`ww-page2`、`ww-page3`、`ww-main` alias。
2. 刪除本專案建立的舊 Rich Menu。
3. 建立新版單頁 Rich Menu。
4. 上傳 `main.jpg`。
5. 建立 `ww-main` alias。
6. 設成所有使用者預設 Rich Menu。

### 指令同步

```bash
npm run sync-richmenu
```

刪除本專案 Rich Menu：

```bash
npm run delete-richmenu
```

## 最新賠率圖片上傳

進入：

```text
/admin → 最新賠率
```

可上傳 PNG / JPG / WEBP 圖片。系統會記錄：

- 圖片路徑
- 原始檔名
- 備註
- 上傳日期時間

前台顯示位置：

```text
/#odds
```

## 必填環境參數

```env
PORT=8080
BASE_URL=https://你的-zeabur-網址
NODE_ENV=production
JWT_SECRET=請改成至少32字元以上的長隨機字串
ADMIN_PASSWORD=69677323
BANK_ACCOUNT=銀行：XXX銀行 / 代碼：000 / 帳號：0000-0000-0000 / 戶名：萬萬沒想到
```

## LINE Login 會員登入

```env
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
```

LINE Developers Callback URL：

```text
https://你的-zeabur-網址/auth/line/callback
```

## LINE Messaging API / Rich Menu 同步

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

注意：Rich Menu 同步使用的是 Messaging API Channel，不是 LINE Login Channel。

## Google Login

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Google OAuth Redirect URI：

```text
https://你的-zeabur-網址/auth/google/callback
```

## 測試

本機測試：

```bash
npm install
PORT=8080 BASE_URL=http://localhost:8080 JWT_SECRET=abcdefghijklmnopqrstuvwxyz123456 ADMIN_PASSWORD=69677323 BANK_ACCOUNT=test npm start
```

開啟：

```text
http://localhost:8080
http://localhost:8080/admin
http://localhost:8080/api/health
```

## 注意事項

目前資料儲存使用 JSON 檔案，適合 MVP 與小量測試。正式長期營運建議升級 PostgreSQL，避免重新部署或多實例造成資料不同步。
