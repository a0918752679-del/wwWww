const $ = (s) => document.querySelector(s);

const admin = {
  dashboard: null,
  products: [],
  orders: [],
  accounting: [],
  async init() {
    $('#adminLoginForm').addEventListener('submit', (e) => this.login(e));
    $('#productForm').addEventListener('submit', (e) => this.saveProduct(e));
    $('#accountingForm').addEventListener('submit', (e) => this.saveAccounting(e));
    await this.check();
  },
  async api(url, opts = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '操作失敗');
    return data;
  },
  toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  },
  async check() {
    try {
      await this.api('/api/admin/me');
      $('#loginScreen').style.display = 'none';
      $('#adminApp').style.display = 'grid';
      await this.refreshAll();
    } catch {
      $('#loginScreen').style.display = 'grid';
      $('#adminApp').style.display = 'none';
    }
  },
  async login(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await this.api('/api/admin/login', { method: 'POST', body: JSON.stringify(body) });
      this.toast('登入成功');
      await this.check();
    } catch (err) { this.toast(err.message); }
  },
  async logout() {
    await this.api('/api/admin/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  },
  async refreshAll() {
    await Promise.all([this.loadDashboard(), this.loadProducts(), this.loadOrders(), this.loadAccounting()]);
  },
  async loadDashboard() {
    const data = await this.api('/api/admin/dashboard');
    this.dashboard = data;
    const s = data.stats;
    $('#stats').innerHTML = [
      ['今日訂單', s.todayOrders], ['待確認付款', s.pendingPayments], ['上架商品', s.activeProducts], ['本日營收', `NT$ ${Number(s.todayRevenue).toLocaleString()}`],
      ['會員數', s.users], ['商品總數', s.products], ['售完商品', s.soldoutProducts], ['累積營收', `NT$ ${Number(s.totalRevenue).toLocaleString()}`]
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><br/><b>${v}</b></div>`).join('');
  },
  async loadProducts() {
    const data = await this.api('/api/admin/products');
    this.products = data.products;
    this.renderProducts();
  },
  renderProducts() {
    $('#productRows').innerHTML = this.products.map(p => `
      <tr>
        <td><div style="display:flex;gap:10px;align-items:center"><img class="product-thumb" src="${p.imageUrl || '/assets/products/placeholder.svg'}"/><div><strong>${p.title}</strong><br/><small>${p.category || ''}</small></div></div></td>
        <td>NT$ ${Number(p.price).toLocaleString()}</td>
        <td>${p.stock}</td>
        <td><span class="pill ${p.status === 'active' ? 'ok' : p.status === 'soldout' ? 'bad' : 'warn'}">${this.statusText(p.status)}</span></td>
        <td style="white-space:nowrap">
          <button class="btn small" onclick="admin.editProduct('${p.id}')">編輯</button>
          ${p.status === 'active' ? `<button class="btn small danger" onclick="admin.unpublish('${p.id}')">下架</button>` : `<button class="btn small ok" onclick="admin.publish('${p.id}')">上架</button>`}
        </td>
      </tr>`).join('');
  },
  statusText(status) { return { active: '上架中', draft: '下架/草稿', soldout: '售完', archived: '封存' }[status] || status; },
  resetForm() { $('#productForm').reset(); $('#productForm [name=id]').value = ''; $('#productForm [name=category]').value = '戰鬥陀螺'; },
  editProduct(id) {
    const p = this.products.find(x => x.id === id);
    if (!p) return;
    const form = $('#productForm');
    for (const key of ['id','title','category','price','stock','status','imageUrl','description']) {
      if (form.elements[key]) form.elements[key].value = p[key] || '';
    }
    location.hash = '#products';
    this.toast('已帶入商品資料，可修改後儲存');
  },
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('讀取圖片失敗'));
      reader.readAsDataURL(file);
    });
  },
  async uploadProductImage(file) {
    if (!file) return '';
    if (file.size > 5 * 1024 * 1024) throw new Error('圖片不可超過 5MB');
    const dataUrl = await this.fileToDataUrl(file);
    const data = await this.api('/api/admin/uploads/product-image', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, dataUrl })
    });
    return data.imageUrl;
  },
  async saveProduct(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    delete body.imageFile;
    body.price = Number(body.price);
    body.stock = Number(body.stock);
    try {
      const file = form.elements.imageFile?.files?.[0];
      if (file) {
        this.toast('圖片上傳中...');
        body.imageUrl = await this.uploadProductImage(file);
        form.elements.imageUrl.value = body.imageUrl;
      }
      if (body.id) {
        const id = body.id; delete body.id;
        await this.api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        this.toast('商品已更新');
      } else {
        delete body.id;
        await this.api('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
        this.toast('商品已新增');
      }
      this.resetForm();
      await this.refreshAll();
    } catch (err) { this.toast(err.message); }
  },
  async publish(id) {
    try { await this.api(`/api/admin/products/${id}/publish`, { method: 'POST', body: '{}' }); this.toast('已上架'); await this.refreshAll(); }
    catch (err) { this.toast(err.message); }
  },
  async unpublish(id) {
    try { await this.api(`/api/admin/products/${id}/unpublish`, { method: 'POST', body: '{}' }); this.toast('已下架'); await this.refreshAll(); }
    catch (err) { this.toast(err.message); }
  },
  async loadOrders() {
    const data = await this.api('/api/admin/orders');
    this.orders = data.orders;
    this.renderOrders();
  },
  renderOrders() {
    $('#orderRows').innerHTML = this.orders.map(o => `
      <tr>
        <td><strong>${o.id}</strong><br/><small>${new Date(o.createdAt).toLocaleString()}</small></td>
        <td>${o.userName || '-'}<br/><small>${o.userEmail || ''}</small></td>
        <td>${(o.items || []).map(i => `${i.title} × ${i.qty}`).join('<br/>')}<br/><strong>NT$ ${Number(o.total).toLocaleString()}</strong></td>
        <td>末五碼：${o.bankLast5 || '-'}<br/>日期：${o.transferDate || '-'}<br/>金額：${Number(o.transferAmount || 0).toLocaleString()}</td>
        <td><span class="pill ${o.status === 'paid' ? 'ok' : o.status === 'cancelled' ? 'bad' : 'warn'}">${this.orderStatus(o.status)}</span></td>
        <td style="white-space:nowrap">
          ${o.status === 'pending_bank' ? `<button class="btn small ok" onclick="admin.confirmPayment('${o.id}')">確認入帳</button><button class="btn small danger" onclick="admin.cancelOrder('${o.id}')">取消</button>` : '-'}
        </td>
      </tr>`).join('');
  },
  orderStatus(status) { return { pending_bank: '待匯款確認', paid: '已付款', cancelled: '已取消' }[status] || status; },
  async confirmPayment(id) {
    if (!confirm('確認已收到這筆匯款？')) return;
    try { await this.api(`/api/admin/orders/${id}/confirm-payment`, { method: 'POST', body: '{}' }); this.toast('已確認付款'); await this.refreshAll(); }
    catch (err) { this.toast(err.message); }
  },
  async cancelOrder(id) {
    if (!confirm('取消訂單會釋放保留庫存，確定？')) return;
    try { await this.api(`/api/admin/orders/${id}/cancel`, { method: 'POST', body: '{}' }); this.toast('已取消並釋放庫存'); await this.refreshAll(); }
    catch (err) { this.toast(err.message); }
  },
  accountingTypeText(type) {
    return { sales_order: '客戶消費', bank_transfer: '匯款入帳', income: '其他收入', expense: '支出', refund: '退款', adjustment: '調整', income: '收入紀錄' }[type] || type || '-';
  },
  accountingStatusText(status) {
    return { pending_bank: '待匯款確認', paid: '已入帳', confirmed: '已確認', cancelled: '已取消', draft: '草稿' }[status] || status || '-';
  },
  sheetStatusText(record) {
    return { synced: '已同步', not_synced: '未同步', needs_resync: '需重同步', failed: '同步失敗' }[record.sheetSyncStatus] || '未同步';
  },
  async loadAccounting() {
    const data = await this.api('/api/admin/accounting');
    this.accounting = data.records || [];
    const sheet = data.sheet || {};
    const el = $('#sheetStatus');
    if (sheet.enabled) {
      el.innerHTML = `Google Sheet 已設定：<strong>${sheet.tab}</strong>。未同步或需重同步的紀錄可一鍵寫入。`;
    } else {
      el.innerHTML = `Google Sheet 尚未完成設定。請在 Zeabur Variables 設定：<code>${(sheet.missing || []).join('</code>、<code>')}</code>`;
    }
    this.renderAccounting();
  },
  renderAccounting() {
    $('#accountingRows').innerHTML = this.accounting.map(r => `
      <tr>
        <td><strong>${r.id}</strong><br/><small>${new Date(r.createdAt).toLocaleString()}</small></td>
        <td>${this.accountingTypeText(r.type)}<br/><span class="pill ${r.status === 'paid' || r.status === 'confirmed' ? 'ok' : r.status === 'cancelled' ? 'bad' : 'warn'}">${this.accountingStatusText(r.status)}</span></td>
        <td>${r.customerName || '-'}<br/><small>${r.customerEmail || ''}${r.customerPhone ? '<br/>'+r.customerPhone : ''}</small></td>
        <td>${r.itemSummary || '-'}<br/><small>${r.orderId || ''}</small></td>
        <td><strong>NT$ ${Number(r.amount || 0).toLocaleString()}</strong></td>
        <td>${r.method || '-'}<br/>日期：${r.transferDate || '-'}<br/>末五碼：${r.bankLast5 || '-'}</td>
        <td><span class="pill ${r.sheetSyncStatus === 'synced' ? 'ok' : r.sheetSyncStatus === 'failed' ? 'bad' : 'warn'}">${this.sheetStatusText(r)}</span><br/><small>${r.sheetSyncedAt ? new Date(r.sheetSyncedAt).toLocaleString() : (r.sheetError || '')}</small></td>
        <td style="white-space:nowrap"><button class="btn small" onclick="admin.editAccounting('${r.id}')">編輯</button><button class="btn small ok" onclick="admin.syncAccounting('${r.id}')">同步</button></td>
      </tr>`).join('') || '<tr><td colspan="8">尚無記帳紀錄</td></tr>';
  },
  resetAccountingForm() {
    $('#accountingForm').reset();
    $('#accountingForm [name=id]').value = '';
    $('#accountingForm [name=type]').value = 'sales_order';
    $('#accountingForm [name=method]').value = 'bank_transfer';
  },
  editAccounting(id) {
    const r = this.accounting.find(x => x.id === id);
    if (!r) return;
    const form = $('#accountingForm');
    for (const key of ['id','type','status','customerName','customerEmail','customerPhone','amount','method','transferDate','bankLast5','orderId','itemSummary','note']) {
      if (form.elements[key]) form.elements[key].value = r[key] || '';
    }
    location.hash = '#accounting';
    this.toast('已帶入記帳資料，可修改後儲存');
  },
  async saveAccounting(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    body.amount = Number(body.amount);
    try {
      if (body.id) {
        const id = body.id; delete body.id;
        await this.api(`/api/admin/accounting/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        this.toast('記帳紀錄已更新');
      } else {
        delete body.id;
        await this.api('/api/admin/accounting', { method: 'POST', body: JSON.stringify(body) });
        this.toast('記帳紀錄已新增');
      }
      this.resetAccountingForm();
      await this.refreshAll();
    } catch (err) { this.toast(err.message); }
  },
  async syncAccounting(id) {
    try {
      await this.api(`/api/admin/accounting/${id}/sync`, { method: 'POST', body: '{}' });
      this.toast('已同步到 Google Sheet');
      await this.loadAccounting();
    } catch (err) { this.toast(err.message); }
  },
  async syncAllAccounting() {
    if (!confirm('確認同步所有未同步或需重同步的記帳紀錄到 Google Sheet？')) return;
    try {
      const data = await this.api('/api/admin/accounting/sync-all', { method: 'POST', body: '{}' });
      this.toast(`已同步 ${data.result?.count || 0} 筆`);
      await this.loadAccounting();
    } catch (err) { this.toast(err.message); }
  },
  async loadRichMenuStatus() {
    const el = $('#richmenuStatus');
    el.textContent = '查詢中...';
    try {
      const data = await this.api('/api/admin/line/richmenu/status');
      el.textContent = JSON.stringify(data, null, 2);
      this.toast('Rich Menu 狀態已更新');
    } catch (err) {
      el.textContent = err.message;
      this.toast(err.message);
    }
  },
  async syncRichMenu() {
    if (!confirm('確認要同步三頁 LINE Rich Menu？這會刪除本專案舊的 WW Beyblade V8 Rich Menu 後重新建立。')) return;
    const el = $('#richmenuStatus');
    el.textContent = '同步中，請稍候...';
    try {
      const data = await this.api('/api/admin/line/richmenu/sync', { method: 'POST', body: '{}' });
      el.textContent = [data.stdout, data.stderr].filter(Boolean).join('\n');
      this.toast('Rich Menu 已同步');
      await this.loadRichMenuStatus();
    } catch (err) {
      el.textContent = err.message;
      this.toast(err.message);
    }
  },
  async deleteRichMenu() {
    if (!confirm('確認刪除本專案建立的 WW Beyblade V8 Rich Menu？')) return;
    const el = $('#richmenuStatus');
    el.textContent = '刪除中，請稍候...';
    try {
      const data = await this.api('/api/admin/line/richmenu/delete', { method: 'POST', body: '{}' });
      el.textContent = [data.stdout, data.stderr].filter(Boolean).join('\n');
      this.toast('Rich Menu 已刪除');
    } catch (err) {
      el.textContent = err.message;
      this.toast(err.message);
    }
  }
};
window.admin = admin;
admin.init();
