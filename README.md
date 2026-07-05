# WW Beyblade Kuji Zeabur V9

本版修正 LINE Rich Menu：

- Rich Menu 圖片尺寸改為 2500 x 1150。
- 移除 V8 圖片底部三分頁導覽，避免與 LINE App 原生下方收合列重疊。
- 分頁切換改放在圖片上方三個按鈕：首頁、我的紀錄、最新消息。
- 三頁 chatBarText 統一為「選單」，避免下方原生列顯示成「我的紀錄」造成誤解。
- sync/delete 腳本會清除本專案 V7、V8、V9 Rich Menu 與 alias 後重建。

部署後請至後台：
1. 刪除本專案 Rich Menu
2. 一鍵同步 Rich Menu
3. 查詢狀態確認 ww-page1 / ww-page2 / ww-page3 存在

LINE App 仍可能快取 Rich Menu。同步後請關閉聊天室重開；必要時封鎖官方帳號後解除封鎖測試。
