# LINE / Google / 自主會員登入設定

## 1. 自主網站帳號

不需要任何第三方設定。

前台點「登入會員」後可使用：

- 建立新會員
- Email 登入
- 密碼登入

資料寫入：

```text
data/db.json > users
```

---

## 2. LINE Login

### LINE Developers 設定

1. 進入 LINE Developers。
2. 建立 Provider。
3. 建立 LINE Login Channel。
4. 進入 LINE Login Channel 設定。
5. Callback URL 填入：

```text
https://你的網域/auth/line/callback
```

6. 取得：

```env
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
```

7. 填到 Zeabur 的環境變數。
8. 重新部署。

### 前台登入入口

```text
/auth/line
```

---

## 3. Google Login

### Google Cloud Console 設定

1. 建立 Google Cloud Project。
2. 設定 OAuth Consent Screen。
3. 建立 OAuth 2.0 Client ID。
4. Application type 選 Web application。
5. Authorized redirect URI 填入：

```text
https://你的網域/auth/google/callback
```

6. 取得：

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

7. 填到 Zeabur 的環境變數。
8. 重新部署。

### 前台登入入口

```text
/auth/google
```
