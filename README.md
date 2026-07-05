# WW Beyblade Kuji Zeabur V8

本版修正 LINE Rich Menu 顯示比例與分頁切換：

- Rich Menu 維持 LINE compact 標準尺寸 `2500 x 843`。
- 三頁圖片重新整理為固定底部三分頁：`首頁 / 我的紀錄 / 最新消息`。
- 分頁切換區改為可見按鈕，不再使用隱藏點擊區。
- 同步腳本會清除本專案 V7/V8 舊 alias 與舊 Rich Menu。
- 圖片上傳使用 LINE 正確端點 `https://api-data.line.me`。

## 重新部署後操作

1. Zeabur 上傳本 ZIP 並重新部署。
2. 進後台 → LINE Rich Menu 同步。
3. 先按「刪除本專案 Rich Menu」。
4. 再按「一鍵同步 Rich Menu」。
5. 查詢狀態，確認有 `ww-page1`、`ww-page2`、`ww-page3`。
6. 手機 LINE 關閉聊天室後重新進入；必要時封鎖官方帳號再解除封鎖刷新快取。
