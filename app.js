/* No external scripts. All user-controlled text is escaped before rendering. */
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso = cents => new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP'}).format(cents/100);
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const option = (value, name) => `<option value="${esc(value)}">${esc(name)}</option>`;
const field = (label, name, type='text', extra='') => `<label class="field">${label}<input name="${name}" type="${type}" ${extra} required></label>`;
const stat = (label, value) => `<div class="stat"><span>${label}</span><strong>${esc(value)}</strong></div>`;
const empty = cols => `<tr><td class="empty" colspan="${cols}">No records yet. Add one to get started.</td></tr>`;
let toastTimer;
function toast(message, error=false) { const el=$('#toast'); el.textContent=message; el.className=error?'error':''; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,6000); }
async function api(app, path, method='GET', data) {
  const response = await fetch(`/api/${app}${path}`, {method, ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function bindForm(selector, action) {
  $(selector).addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    try { await action(Object.fromEntries(new FormData(form)), form); } catch(error) { toast(error.message,true); }
    finally { button.disabled=false; }
  });
}
function bindAction(selector, action) {
  $(selector).addEventListener('click', async event => { const button=event.target.closest('button'); if(!button) return; button.disabled=true;
    try { await action(button); } catch(error) { toast(error.message,true); } finally { button.disabled=false; }
  });
}
function hero(number, heading, description, track) { return `<header class="hero hero-row"><div><div class="eyebrow">SmartFind / ${track}</div><h1>${heading}</h1><p>${description}</p></div><span class="badge">Interactive demo</span></header>`; }
async function smartfind() {
  $('#view').innerHTML=hero('01','Stock, without the guesswork.','Search a school-supplies inventory, record changes and spot products that need restocking.','Web development')+`<div class="stats" id="stats"></div><div class="split"><section class="panel"><div class="toolbar"><h2>Product inventory</h2><input id="search" type="search" aria-label="Search products" placeholder="Search name, SKU or category"></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody id="products"></tbody></table></div></section><div><section class="panel"><h2>Add a product</h2><form id="add-product">${field('Product name','name','text','maxlength="120"')}${field('SKU','sku','text','maxlength="30"')}${field('Category','category','text','maxlength="40"')}<div class="field-row">${field('Price (PHP)','price','number','min="0" max="1000000" step="0.01"')}${field('Opening stock','stock','number','min="0" max="1000000" step="1"')}</div>${field('Reorder level','reorder_level','number','min="0" max="1000000" value="5"')}<button type="submit">Add product</button></form></section><section class="panel"><h2>Adjust stock</h2><form id="adjust-stock"><label class="field">Product<select name="product_id" id="product-select" required></select></label>${field('Change (+ incoming, − outgoing)','delta','number','min="-1000000" max="1000000" step="1"')}${field('Reason','reason','text','maxlength="200"')}<button type="submit">Record adjustment</button></form></section></div></div><section class="panel below"><h2>Recent stock movements</h2><div id="movements" class="ledger"></div></section>`;
  let products=[];
  function render() { const term=$('#search').value.toLowerCase(); $('#products').innerHTML=products.filter(p=>`${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(term)).map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)}</small></td><td>${peso(p.price_cents)}</td><td>${p.stock}</td><td><span class="tag ${p.stock===0?'bad':p.low_stock?'warning':''}">${p.stock===0?'Out of stock':p.low_stock?'Low stock':'Available'}</span></td></tr>`).join('')||empty(4); }
  async function refresh() { const [items,movements]=await Promise.all([api('smartfind','/products'),api('smartfind','/movements')]); products=items; render(); $('#product-select').innerHTML=products.map(p=>option(p.id,p.name)).join(''); $('#stats').innerHTML=stat('Products',products.length)+stat('Low / empty stock',products.filter(p=>p.low_stock).length)+stat('Inventory value',peso(products.reduce((sum,p)=>sum+p.price_cents*p.stock,0))); $('#movements').innerHTML=movements.map(m=>`<div class="ledger-entry"><span>${m.delta>0?'+':''}${m.delta} units</span>${esc(m.name)}<small>${esc(m.reason)} · ${esc(m.created_at)} UTC</small></div>`).join(''); }
  $('#search').addEventListener('input',render);
  bindForm('#add-product',async(d,f)=>{ await api('smartfind','/products','POST',{...d,stock:Number(d.stock),reorder_level:Number(d.reorder_level)}); f.reset(); await refresh(); toast('Product added.'); });
  bindForm('#adjust-stock',async(d,f)=>{ await api('smartfind','/adjust','POST',{...d,product_id:Number(d.product_id),delta:Number(d.delta)}); f.reset(); await refresh(); toast('Stock adjustment recorded.'); });
  await refresh();
}
Promise.resolve().then(()=>smartfind()).catch(error=>{toast(error.message,true); console.error(error);});
