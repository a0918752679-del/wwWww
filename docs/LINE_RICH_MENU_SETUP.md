# LINE Rich Menu 設定說明

本版已將使用者提供的三張圖整理成 LINE Rich Menu compact 規格：

- `public/assets/richmenu/page1.jpg`：首頁
- `public/assets/richmenu/page2.jpg`：我的紀錄
- `public/assets/richmenu/page3.jpg`：關於我們
- 尺寸：`2500 x 843 px`
- 格式：JPEG
- 設定檔：`public/assets/richmenu/richmenu-actions.json`

## 功能配置

### Page 1 首頁

| 區塊 | 功能 |
|---|---|
| 立即刮刮樂 | 開啟 `/#pools` |
| 購買方案 | 開啟 `/#shop` |
| 我的獎品 | 切換 Page 2 |
| 活動辦法 | 開啟 `/#rules` |
| 會員中心 | 開啟 `/#member` |
| 客服專區 | 傳送「客服」訊息 |
| 最新消息 | 切換 Page 3 |

### Page 2 我的紀錄

| 區塊 | 功能 |
|---|---|
| 刮刮卡紀錄 | 開啟 `/#draws` |
| 中獎紀錄 | 開啟 `/#history` |
| 出貨進度 | 開啟 `/#shipping` |
| 我的點數 | 開啟 `/#wallet` |
| 下方橫幅 | 切換 Page 1 / Page 3 |

### Page 3 關於我們

| 區塊 | 功能 |
|---|---|
| 最新消息 | 開啟 `/#news` |
| 商品介紹 | 開啟 `/#shop` |
| 合作洽詢 | 開啟 `/#partners` |
| 門市資訊 | 開啟 `/#stores` |
| 客服專區 | 傳送「常見問題」訊息 |
| 下方橫幅 | 返回 Page 1 |

## 需要的環境參數

Rich Menu 使用的是 Messaging API Channel，不是 LINE Login Channel。

```env
LINE_CHANNEL_ACCESS_TOKEN=Messaging API Channel access token
LINE_CHANNEL_SECRET=Messaging API Channel secret
BASE_URL=https://你的-zeabur-網址
```

## 後台一鍵同步

1. 部署至 Zeabur。
2. 到 Zeabur Variables 填入 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`BASE_URL`。
3. 重新部署或 Restart。
4. 開啟 `/admin`。
5. 進入「Rich Menu」。
6. 點「一鍵同步 Rich Menu」。

系統會自動：

1. 刪除本專案舊的 `WW Beyblade V7` Rich Menu。
2. 建立 Page 1 / Page 2 / Page 3。
3. 上傳三張圖片。
4. 建立 Alias：`ww-page1`、`ww-page2`、`ww-page3`。
5. 將 Page 1 設為 Default Rich Menu。

## 指令同步

本地或 Zeabur Console 也可以執行：

```bash
npm run sync-richmenu
```

刪除本專案 Rich Menu：

```bash
npm run delete-richmenu
```

## 注意

- LINE Rich Menu 圖片上傳後，重新開啟 LINE 聊天室才會看到，可能需要約 1 分鐘。
- 本腳本只會刪除名稱以 `WW Beyblade V7` 開頭的 Rich Menu，避免誤刪其他官方帳號選單。
- 三頁切換使用 `Rich Menu Alias + Switch Action`，不需要額外傳訊息。
