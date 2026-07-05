const $ = (s) => document.querySelector(s);

const admin = {
  dashboard: null,
  products: [],
  orders: [],
  async init() {
    $('#adminLoginForm').addEventListener('submit', (e) => this.login(e));
    $('#productForm').addEventListener('submit', (e) => this.saveProduct(e));
    $('#oddsForm').addEventListener('submit', (e) => this.uploadOdds(e));
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
    location.reload();
  },
  async refreshAll() {
    await Promise.all([this.loadDashboard(), this.loadProducts(), this.loadOrders(), this.loadOdds()]);
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
  async saveProduct(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    body.price = Number(body.price);
    body.stock = Number(body.stock);
    try {
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
  async loadOdds() {
    try {
      const data = await this.api('/api/admin/odds');
      const latest = data.latestOdds;
      const box = $('#oddsPreview');
      if (!latest) {
        box.className = 'notice';
        box.textContent = '目前尚未上傳最新賠率圖片。';
        return;
      }
      box.className = '';
      box.innerHTML = `
        <div class="order-card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
            <strong>目前最新賠率</strong>
            <span class="pill ok">${new Date(latest.uploadedAt).toLocaleString()}</span>
          </div>
          <p>${latest.note || '無備註'}</p>
          <img src="${latest.imageUrl}" alt="最新賠率" style="width:100%;max-width:720px;border-radius:22px;border:1px solid #e2e8f0" />
        </div>`;
    } catch (err) {
      $('#oddsPreview').textContent = err.message;
    }
  },
  async uploadOdds(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = form.elements.oddsImage.files[0];
    if (!file) return this.toast('請選擇賠率圖片');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const body = { imageData: reader.result, filename: file.name, note: form.elements.note.value || '' };
        await this.api('/api/admin/odds/upload', { method: 'POST', body: JSON.stringify(body) });
        this.toast('最新賠率已上傳');
        form.reset();
        await this.loadOdds();
      } catch (err) { this.toast(err.message); }
    };
    reader.readAsDataURL(file);
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
    if (!confirm('確認要同步新版單頁 LINE Rich Menu？這會刪除本專案舊的三頁 Rich Menu 後重新建立。')) return;
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
    if (!confirm('確認刪除本專案建立的 WW Beyblade Rich Menu？')) return;
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
