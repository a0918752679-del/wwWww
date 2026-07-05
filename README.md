# 萬萬沒想到｜戰鬥陀螺線上一番賞 V7

本版重點：

- 會員登入：LINE Login、Google Login、自主網站帳號註冊 / 登入
- 付款方式：銀行匯款
- 後台機制：內部人員可上架、下架、補庫存、新增商品
- 訂單機制：客人送出匯款資料後，後台人工確認入帳
- 庫存防呆：銀行匯款訂單成立時會先保留庫存，避免超賣
- 手機版 UI：前台與後台皆可用手機操作
- Zeabur ready：`npm start` 即可啟動

- LINE Rich Menu：已套用三張使用者提供圖檔，支援後台一鍵同步、三頁 Alias + Switch Action 切換

---

## 入口

- 前台：`/`
- 後台：`/admin`
- 預設後台密碼：`69677323`

---

## 本地測試

```bash
npm install
cp .env.example .env
npm start
```

開啟：

```text
http://localhost:8080
```

---

## Zeabur 部署

1. 將本資料夾上傳 GitHub。
2. Zeabur 新增 Project。
3. 選擇 GitHub Repository。
4. Build Command：`npm install`
5. Start Command：`npm start`
6. 設定環境變數。
7. 部署完成後，把 `BASE_URL` 改成 Zeabur 的正式網址。

---

## Callback URL

假設你的網址是：

```text
https://ww2ww.zeabur.app
```

### LINE Login Callback

```text
https://ww2ww.zeabur.app/auth/line/callback
```

### Google Login Callback

```text
https://ww2ww.zeabur.app/auth/google/callback
```

---

## 使用流程

### 客戶端

1. 進入首頁。
2. 使用 LINE、Google 或自主帳號登入。
3. 選擇商品加入購物車。
4. 選擇銀行匯款。
5. 匯款後填寫末五碼、日期、金額。
6. 系統建立待確認訂單並保留庫存。
7. 內部人員確認付款後，訂單狀態改為已付款。

### 內部後台

1. 進入 `/admin`。
2. 輸入後台密碼。
3. 查看 Dashboard。
4. 商品上下架：新增、編輯、補庫存、上架、下架。
5. 匯款確認：確認入帳或取消訂單。
6. Rich Menu：一鍵同步三頁 LINE Rich Menu。
7. 取消訂單會自動釋放保留庫存。

---

## 注意

目前使用 JSON 檔案儲存資料，適合 MVP / 初期測試。正式大量營運建議升級 PostgreSQL。


---

## LINE Rich Menu

三張 Rich Menu 圖檔已放在：

```text
public/assets/richmenu/page1.jpg
public/assets/richmenu/page2.jpg
public/assets/richmenu/page3.jpg
```

同步方式：

```bash
npm run sync-richmenu
```

或從後台 `/admin` → `Rich Menu` → `一鍵同步 Rich Menu`。

詳細說明見：

```text
docs/LINE_RICH_MENU_SETUP.md
```


# V8 更新重點

本版依照最新需求調整：

- 移除舊版三頁 Rich Menu 圖檔。
- Rich Menu 改為單張新版圖檔：`public/assets/richmenu/main.jpg`。
- Rich Menu 僅保留三個功能：
  - 立即刮刮樂：`/#shop`
  - 最新賠率：`/#odds`
  - 最新活動：`/#events`
- 後台新增「最新賠率上傳」功能，可上傳 PNG / JPG / WEBP 圖片。
- 系統會記錄最新賠率圖片的上傳日期時間、原始檔名與備註。
- 前台新增「最新賠率」區塊，會顯示後台上傳的圖片與更新時間。

## Rich Menu 同步

部署後進入 `/admin`，點選「Rich Menu → 一鍵同步 Rich Menu」。

同步前需在 Zeabur Variables 填入：

```env
LINE_CHANNEL_ACCESS_TOKEN=Messaging API Channel access token
LINE_CHANNEL_SECRET=Messaging API Channel secret
BASE_URL=https://你的zeabur網址
```

也可執行：

```bash
npm run sync-richmenu
```

同步腳本會刪除本專案舊的 `WW Beyblade V7` / `WW Beyblade V8` Rich Menu 與 alias，避免舊圖殘留。

## 最新賠率上傳

後台路徑：

```text
/admin → 最新賠率
```

上傳後客戶端可在：

```text
/#odds
```

查看最新賠率圖片與更新時間。
