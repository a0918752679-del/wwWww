# Zeabur 建置修正版說明

本版修正 Zeabur 建置卡在 `RUN npm install` 的風險點：

1. 移除原封包內含內部 registry URL 的 `package-lock.json`。
2. 新增 `.npmrc`，強制使用 `https://registry.npmjs.org/`。
3. 新增 `Dockerfile`，固定使用 `node:20-alpine`，避免 Zeabur 自動使用 `node:24`。
4. 新增 `.dockerignore`，避免 node_modules、暫存檔、舊版 build 檔進入映像檔。
5. 移除 `public/admin.js.tmp` 暫存檔。

Zeabur 建議：
- 重新上傳本 ZIP 後，請使用 Redeploy / Clear Cache 後重新建置。
- 若仍卡在 install，請確認 Zeabur 服務是否可連外至 npm registry。
