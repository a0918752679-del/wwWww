# WW Beyblade Kuji Zeabur V10

## Rich Menu 修正

- Rich Menu 圖片尺寸改為 `2500 x 1350`。
- 移除上方 `PAGE / 首頁 / 我的紀錄 / 最新消息` 分頁按鈕列，避免遮住主畫面。
- LINE Rich Menu 不支援真正滑動動畫；本版改成左右窄邊點擊區：點左側切上一頁、點右側切下一頁。
- 三頁 alias 維持：`ww-page1`、`ww-page2`、`ww-page3`。
- 同步腳本會清除 V7 / V8 / V9 / V10 舊選單與 alias 後重建。

部署後：後台 → LINE Rich Menu 同步 → 先刪除本專案 Rich Menu → 再一鍵同步。
