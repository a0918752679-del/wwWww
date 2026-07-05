# Zeabur Deploy Fix Note

V2 修正重點：

- Dockerfile 不再 `COPY .npmrc`，避免 Zeabur 上傳/解壓時未帶入 dotfile 造成 `.npmrc: not found`。
- 仍保留 `ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` 與 `npm config set registry`，確保 npm 使用公開 registry。
- 不使用 package-lock.json，避免舊 lock 檔指向內部 registry。
