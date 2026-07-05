# LINE Rich Menu 設定說明｜V8 單頁版

本版已移除舊版三頁 Rich Menu 圖檔，只保留：

```text
public/assets/richmenu/main.jpg
public/assets/richmenu/richmenu-actions.json
```

## 功能區域

| 功能 | 點擊區域 | 連結 |
|---|---|---|
| 立即刮刮樂 | 左側 1/3 | `/#shop` |
| 最新賠率 | 中間 1/3 | `/#odds` |
| 最新活動 | 右側 1/3 | `/#events` |

## Zeabur 必填參數

```env
BASE_URL=https://你的zeabur網址
LINE_CHANNEL_ACCESS_TOKEN=Messaging API 的 Channel access token
LINE_CHANNEL_SECRET=Messaging API 的 Channel secret
```

注意：這裡使用的是 Messaging API Channel，不是 LINE Login Channel。

## 後台同步

部署完成後進入：

```text
/admin
```

點選：

```text
Rich Menu → 一鍵同步 Rich Menu
```

或在命令列執行：

```bash
npm run sync-richmenu
```

同步時會刪除本專案舊的 `WW Beyblade V7` 和 `WW Beyblade V8` Rich Menu，避免舊圖殘留。
