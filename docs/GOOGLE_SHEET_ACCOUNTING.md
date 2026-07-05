# Google Sheet 記帳同步設定

後台已新增「記帳紀錄 / Google Sheet」功能，可管理：

- 客戶消費紀錄
- 匯款入帳紀錄
- 手動收入、支出、退款、調整紀錄
- 匯出 CSV
- 同步未同步紀錄到 Google Sheet

## 1. Google Sheet 欄位

請先建立一個 Google Sheet，並建立工作表分頁：

```txt
消費匯款紀錄
```

第一列建議放以下欄位：

```txt
建立時間, 更新時間, 紀錄ID, 類型, type, 狀態, 來源, 訂單ID, 付款ID, 客戶姓名, Email, 電話, 商品/項目, 金額, 付款方式, 匯款日期, 帳號末五碼, 備註
```

## 2. Zeabur 環境變數

```env
GOOGLE_SHEET_ID=你的 Google Sheet ID
GOOGLE_SHEET_TAB_ACCOUNTING=消費匯款紀錄
GOOGLE_SERVICE_ACCOUNT_EMAIL=你的 service account email
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

## 3. 權限設定

請把 Google Sheet 分享給：

```txt
GOOGLE_SERVICE_ACCOUNT_EMAIL
```

權限設為「編輯者」。否則後台同步會顯示權限錯誤。

## 4. 後台操作

登入後台後，進入：

```txt
記帳紀錄 / Google Sheet
```

可執行：

- 新增手動記帳紀錄
- 編輯紀錄
- 單筆同步
- 一鍵同步未同步紀錄
- 匯出 CSV

訂單建立時會自動產生「客戶消費紀錄」。
匯款確認後會自動產生「匯款入帳紀錄」。
