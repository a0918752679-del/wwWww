# 銀行匯款流程

## 客戶端

1. 登入會員。
2. 加入商品到購物車。
3. 點「去結帳」。
4. 看到匯款帳號。
5. 匯款。
6. 填寫：
   - 匯款帳號末五碼
   - 匯款日期
   - 匯款金額
   - 備註
7. 送出。

系統會建立：

```text
Orders：pending_bank
Payments：pending_review
```

同時商品庫存會先扣減保留。

## 後台

1. 進入 `/admin`。
2. 查看「銀行匯款確認」。
3. 對帳確認有入帳。
4. 點「確認入帳」。
5. 訂單改為：

```text
Orders：paid
Payments：paid
Accounting：新增收入紀錄
```

## 取消訂單

如果客人沒有匯款或資料錯誤，後台可點「取消」。

取消後：

```text
Orders：cancelled
Payments：cancelled
商品庫存自動加回
```
