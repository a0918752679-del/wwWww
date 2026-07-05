const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const app = {
  config: null,
  user: null,
  products: [],
  cart: new Map(),
  async init() {
    this.bind();
    await this.loadConfig();
    await this.loadMe();
    await this.loadProducts();
    await this.loadOrders();
  },
  bind() {
    $('#loginBtn').addEventListener('click', () => this.openAuth());
    $('#heroLogin').addEventListener('click', () => this.openAuth());
    $('#bottomLogin').addEventListener('click', (e) => { e.preventDefault(); this.openAuth(); });
    $('#checkoutBtn').addEventListener('click', () => this.openCheckout());
    $$('[data-close]').forEach((el) => el.addEventListener('click', () => this.closeModal(el.dataset.close)));
    $('#tabLogin').addEventListener('click', () => this.switchAuthTab('login'));
    $('#tabRegister').addEventListener('click', () => this.switchAuthTab('register'));
    $('#loginForm').addEventListener('submit', (e) => this.localLogin(e));
    $('#registerForm').addEventListener('submit', (e) => this.localRegister(e));
    $('#checkoutForm').addEventListener('submit', (e) => this.createOrder(e));
    $$('.modal').forEach((modal) => modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); }));
  },
  async api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      credentials: 'same-origin',
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
  openAuth() {
    if (this.user) {
      this.toast(`${this.user.name} 已登入`);
      location.hash = '#orders';
      return;
    }
    $('#authModal').classList.add('show');
  },
  closeModal(id) { $(`#${id}`).classList.remove('show'); },
  switchAuthTab(tab) {
    const isLogin = tab === 'login';
    $('#tabLogin').classList.toggle('active', isLogin);
    $('#tabRegister').classList.toggle('active', !isLogin);
    $('#loginForm').style.display = isLogin ? 'block' : 'none';
    $('#registerForm').style.display = isLogin ? 'none' : 'block';
  },
  async loadConfig() {
    this.config = await this.api('/api/config');
    $('#bankAccount').textContent = this.config.bankAccount;
    $('#lineLoginLink').classList.toggle('ghost', !this.config.features.lineLogin);
    $('#googleLoginLink').classList.toggle('ghost', !this.config.features.googleLogin);
  },
  async loadMe() {
    const data = await this.api('/api/auth/me');
    this.user = data.user;
    this.renderMember();
  },
  renderMember() {
    const box = $('#memberBox');
    if (this.user) {
      box.style.display = 'block';
      box.innerHTML = `已登入：<strong>${this.user.name}</strong>　登入方式：${this.user.provider || 'local'} <button class="btn small ghost" onclick="app.logout()">登出</button>`;
      $('#loginBtn').textContent = this.user.name;
    } else {
      box.style.display = 'none';
      $('#loginBtn').textContent = '登入會員';
    }
  },
  async logout() {
    await this.api('/api/auth/logout', { method: 'POST', body: '{}' });
    this.user = null;
    this.renderMember();
    this.toast('已登出');
  },
  async localLogin(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const data = await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
      this.user = data.user;
      this.renderMember();
      this.closeModal('authModal');
      this.toast('登入成功');
      this.loadOrders();
    } catch (err) { this.toast(err.message); }
  },
  async localRegister(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const data = await this.api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
      this.user = data.user;
      this.renderMember();
      this.closeModal('authModal');
      this.toast('會員建立成功');
      this.loadOrders();
    } catch (err) { this.toast(err.message); }
  },
  async loadProducts() {
    const data = await this.api('/api/products');
    this.products = data.products;
    this.renderProducts();
  },
  renderProducts() {
    const root = $('#products');
    root.innerHTML = this.products.map((p) => {
      const soldout = p.status === 'soldout' || Number(p.stock) <= 0;
      return `
      <article class="product">
        <img src="${p.imageUrl || '/assets/products/placeholder.svg'}" alt="${p.title}" loading="lazy" />
        <div class="product-body">
          <div class="meta"><span class="pill">${p.category || '商品'}</span><span class="pill ${soldout ? 'bad' : 'ok'}">${soldout ? 'SOLD OUT' : `庫存 ${p.stock}`}</span></div>
          <h3>${p.title}</h3>
          <div class="price">NT$ ${Number(p.price).toLocaleString()}</div>
          <p style="min-height:44px;color:#64748b;margin:0 0 10px">${p.description || ''}</p>
          ${soldout ? '<button class="btn ghost" disabled style="width:100%">已售完</button>' : `<button class="btn primary" style="width:100%" onclick="app.addToCart('${p.id}')">加入購物車</button>`}
        </div>
      </article>`;
    }).join('');
  },
  addToCart(productId) {
    const p = this.products.find(x => x.id === productId);
    if (!p) return;
    const current = this.cart.get(productId) || 0;
    if (current + 1 > Number(p.stock)) return this.toast(`庫存不足，目前剩 ${p.stock}`);
    this.cart.set(productId, current + 1);
    this.renderCart();
    this.toast(`${p.title} 已加入`);
  },
  removeFromCart(productId) {
    const current = this.cart.get(productId) || 0;
    if (current <= 1) this.cart.delete(productId); else this.cart.set(productId, current - 1);
    this.renderCart();
  },
  cartItems() {
    return Array.from(this.cart.entries()).map(([productId, qty]) => ({ product: this.products.find(p => p.id === productId), qty })).filter(x => x.product);
  },
  cartTotal() {
    return this.cartItems().reduce((s, x) => s + Number(x.product.price) * x.qty, 0);
  },
  renderCart() {
    const count = this.cartItems().reduce((s, x) => s + x.qty, 0);
    const total = this.cartTotal();
    $('#cartSummary').textContent = `${count} 件｜NT$ ${total.toLocaleString()}`;
    $('#cartFloat').classList.toggle('show', count > 0);
  },
  openCheckout() {
    if (!this.user) { this.openAuth(); return this.toast('請先登入會員'); }
    const items = this.cartItems();
    if (!items.length) return;
    const total = this.cartTotal();
    $('#checkoutItems').innerHTML = items.map(x => `
      <div class="order-card" style="display:flex;align-items:center;gap:10px">
        <img src="${x.product.imageUrl}" alt="" style="width:72px;height:56px;object-fit:cover;border-radius:14px" />
        <div style="flex:1"><strong>${x.product.title}</strong><br/><small>${x.qty} 件 × NT$ ${Number(x.product.price).toLocaleString()}</small></div>
        <button class="btn small ghost" onclick="app.removeFromCart('${x.product.id}'); app.openCheckout();">移除</button>
      </div>`).join('') + `<h3>合計：NT$ ${total.toLocaleString()}</h3>`;
    $('#checkoutForm [name=transferAmount]').value = total;
    $('#checkoutModal').classList.add('show');
  },
  async createOrder(e) {
    e.preventDefault();
    const items = this.cartItems().map(x => ({ productId: x.product.id, qty: x.qty }));
    const bank = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const data = await this.api('/api/orders', { method: 'POST', body: JSON.stringify({ items, bank }) });
      this.cart.clear();
      this.renderCart();
      this.closeModal('checkoutModal');
      await this.loadProducts();
      await this.loadOrders();
      this.toast(`訂單已建立：${data.order.id}`);
      location.hash = '#orders';
    } catch (err) { this.toast(err.message); }
  },
  async loadOrders() {
    if (!this.user) {
      $('#ordersList').className = 'notice';
      $('#ordersList').textContent = '請先登入會員後查詢。';
      return;
    }
    try {
      const data = await this.api('/api/orders/mine');
      if (!data.orders.length) {
        $('#ordersList').className = 'notice';
        $('#ordersList').textContent = '目前沒有消費紀錄。';
        return;
      }
      $('#ordersList').className = '';
      $('#ordersList').innerHTML = data.orders.map(o => `
        <div class="order-card">
          <div style="display:flex;justify-content:space-between;gap:10px"><strong>${o.id}</strong><span class="status ${o.status}">${this.statusText(o.status)}</span></div>
          <small>${new Date(o.createdAt).toLocaleString()}</small>
          <div style="margin-top:8px">${(o.items||[]).map(i => `${i.title} × ${i.qty}`).join('、')}</div>
          <h3>NT$ ${Number(o.total).toLocaleString()}</h3>
          <small>匯款末五碼：${o.bankLast5 || '-'}｜匯款日期：${o.transferDate || '-'}</small>
        </div>`).join('');
    } catch (err) { $('#ordersList').textContent = err.message; }
  },
  statusText(status) {
    return { pending_bank: '待確認匯款', paid: '已付款', cancelled: '已取消' }[status] || status;
  }
};

window.app = app;
app.init().catch(err => app.toast(err.message));
