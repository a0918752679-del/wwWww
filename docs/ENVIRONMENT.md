# 環境參數說明

## 必填

```env
PORT=8080
BASE_URL=https://your-project.zeabur.app
JWT_SECRET=change-this-to-a-long-random-string-at-least-32-chars
ADMIN_PASSWORD=69677323
BANK_ACCOUNT=銀行：XXX銀行 / 代碼：000 / 帳號：0000-0000-0000 / 戶名：萬萬沒想到
```

## LINE Login

```env
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
```

LINE Developers 後台要設定：

```text
https://你的網域/auth/line/callback
```

## Google Login

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Google Cloud Console OAuth Client 要設定 Authorized redirect URI：

```text
https://你的網域/auth/google/callback
```

## LINE Bot / Rich Menu 後續推播使用

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

本版登入與銀行匯款不強制需要 Messaging API，但日後要做 LINE 推播與 Rich Menu 自動設定時需要。
