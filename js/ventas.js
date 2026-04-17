const Ventas = {
  _carrito: [],
  _clienteId: null,

  render() {
    const ventas = Storage.getVentas().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const totalVentas  = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const totalCobrado = ventas.reduce((s, v) => s + parseFloat(v.pagadoInicial || 0), 0)
      + Storage.getAbonos().reduce((s, a) => s + parseFloat(a.monto || 0), 0);
    const totalPendiente = ventas.reduce((s, v) => s + Storage.getSaldoVenta(v.id), 0);

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🛒 Pedidos Clientes</h1>
          <p class="page-subtitle">${ventas.length} pedidos de clientes</p>
        </div>
        <button class="btn btn-primary" onclick="Ventas.openCarrito()">+ Nuevo Pedido Cliente</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Pedidos</div>
          <div class="stat-value" style="font-size:18px">${Storage.fmt(totalVentas)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cobrado</div>
          <div class="stat-value" style="font-size:18px;color:var(--success)">${Storage.fmt(totalCobrado)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pendiente</div>
          <div class="stat-value" style="font-size:18px;color:var(--danger)">${Storage.fmt(totalPendiente)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Nro. Pedidos</div>
          <div class="stat-value">${ventas.length}</div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input type="text" class="search-input" id="vta-q" placeholder="Buscar cliente, fecha..." oninput="Ventas.filter()">
          <select class="form-control" style="width:auto" id="vta-est" onchange="Ventas.filter()">
            <option value="">Todos los estados</option>
            <option>pagado</option><option>parcial</option><option>pendiente</option>
          </select>
        </div>
        <div id="vta-body">${this._table(ventas)}</div>
      </div>`;
  },

  _table(ventas) {
    if (!ventas.length) return `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <h3>Sin pedidos de clientes</h3>
        <p>Crea tu primer pedido cliente con el botón de arriba</p>
      </div>`;

    return `<div class="table-wrapper"><table>
      <thead><tr>
        <th>Fecha</th><th>Cliente</th><th>Productos</th>
        <th>Total</th><th>Pagado Inicial</th><th>Saldo</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        ${ventas.map(v => {
          const saldo = Storage.getSaldoVenta(v.id);
          const estado = saldo <= 0 ? 'pagado' : parseFloat(v.pagadoInicial || 0) > 0 ? 'parcial' : 'pendiente';
          return `
            <tr>
              <td>${Storage.fmtDate(v.fecha)}</td>
              <td>
                <div style="font-weight:600">${v.clienteNombre || '-'}</div>
              </td>
              <td style="font-size:12px;color:var(--text-secondary)">
                ${(v.items||[]).map(i => `${i.nombre} x${i.cantidad}`).join(', ').substr(0, 60)}
                ${((v.items||[]).map(i => `${i.nombre} x${i.cantidad}`).join(', ')).length > 60 ? '...' : ''}
              </td>
              <td><strong>${Storage.fmt(v.total)}</strong></td>
              <td>${Storage.fmt(v.pagadoInicial)}</td>
              <td style="color:${saldo>0?'var(--danger)':'var(--success)'};font-weight:700">${Storage.fmt(saldo)}</td>
              <td>${this._badge(estado)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="Ventas.verDetalle('${v.id}')">👁️</button>
                  ${saldo > 0 ? `<button class="btn btn-success btn-sm" onclick="Ventas.openAbono('${v.id}')">💵 Abonar</button>` : ''}
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  _badge(e) {
    const m = { pagado:'success', parcial:'warning', pendiente:'danger' };
    return `<span class="badge badge-${m[e]||'secondary'}">${e}</span>`;
  },

  filter() {
    const q   = (document.getElementById('vta-q')?.value || '').toLowerCase();
    const est = document.getElementById('vta-est')?.value || '';
    let ventas = Storage.getVentas().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if (q) ventas = ventas.filter(v => `${v.clienteNombre}${v.fecha}`.toLowerCase().includes(q));
    if (est) ventas = ventas.filter(v => {
      const s = Storage.getSaldoVenta(v.id);
      const estado = s<=0?'pagado':parseFloat(v.pagadoInicial||0)>0?'parcial':'pendiente';
      return estado === est;
    });
    document.getElementById('vta-body').innerHTML = this._table(ventas);
  },

  // ── Carrito ──
  openCarrito(clienteIdPre) {
    this._carrito = [];
    this._clienteId = clienteIdPre || null;
    const clientes = Storage.getClientes().sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const productos = Storage.getProductos().filter(p => (p.stock||0) > 0);

    App.openModal('🛒 Nuevo Pedido Cliente', `
      <div class="form-group">
        <label>Cliente *</label>
        <select class="form-control" id="cart-cli">
          <option value="">-- Seleccionar cliente --</option>
          ${clientes.map(c => `<option value="${c.id}" ${c.id===clienteIdPre?'selected':''}>${c.nombre}${Storage.getSaldoCliente(c.id)>0?' (tiene saldo pendiente)':''}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Agregar Producto</label>
        <div style="display:flex;gap:8px">
          <select class="form-control" id="cart-prod" style="flex:1">
            <option value="">-- Seleccionar producto --</option>
            ${productos.map(p => `<option value="${p.id}">${p.nombre} — ${Storage.fmt(p.precioVenta)} (stock: ${p.stock})</option>`).join('')}
          </select>
          <button class="btn btn-outline btn-sm" onclick="Ventas._agregarItem()" style="white-space:nowrap">+ Agregar</button>
        </div>
      </div>

      <div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">Productos en el carrito</div>
      <div id="cart-items" style="min-height:60px;margin-bottom:14px">
        <p style="color:var(--text-secondary);font-size:13px;padding:10px 0">Agrega productos al carrito</p>
      </div>
      <div style="text-align:right;font-size:18px;font-weight:700;color:var(--primary);margin-bottom:16px" id="cart-total">${Storage.fmt(0)}</div>

      <div class="form-row">
        <div class="form-group">
          <label>Pagado en este momento</label>
          <input class="form-control" id="cart-pagado" type="number" step="0.01" min="0" placeholder="0.00" value="0">
        </div>
        <div class="form-group">
          <label>Notas</label>
          <input class="form-control" id="cart-notas" placeholder="Observaciones...">
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Ventas.guardarVenta()">✅ Confirmar Pedido</button>
      </div>`, true);
  },

  _agregarItem() {
    const prodId = document.getElementById('cart-prod')?.value;
    if (!prodId) { App.toast('Selecciona un producto', 'warning'); return; }
    const prod = Storage.getProducto(prodId);
    if (!prod) return;
    const existing = this._carrito.find(i => i.productoId === prodId);
    if (existing) {
      if (existing.cantidad >= (prod.stock || 0)) { App.toast('Sin stock suficiente', 'warning'); return; }
      existing.cantidad++;
    } else {
      this._carrito.push({ productoId: prodId, nombre: prod.nombre, precioUnitario: prod.precioVenta, cantidad: 1, stockMax: prod.stock || 0 });
    }
    this._renderCarritoItems();
  },

  _renderCarritoItems() {
    const el = document.getElementById('cart-items');
    const tot = document.getElementById('cart-total');
    if (!el) return;
    if (!this._carrito.length) {
      el.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;padding:10px 0">Agrega productos al carrito</p>`;
      if (tot) tot.textContent = Storage.fmt(0);
      return;
    }
    const total = this._carrito.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
    el.innerHTML = this._carrito.map((item, idx) => `
      <div class="cart-item">
        ${item.foto ? `<img src="${item.foto}" class="product-thumb" alt="">` : '<div class="product-thumb">📦</div>'}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nombre}</div>
          <div class="cart-item-price">${Storage.fmt(item.precioUnitario)} c/u</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="qty-btn" onclick="Ventas._cambiarCant(${idx},-1)">−</button>
          <span style="min-width:24px;text-align:center;font-weight:700">${item.cantidad}</span>
          <button class="qty-btn" onclick="Ventas._cambiarCant(${idx},1)">+</button>
          <span style="margin-left:6px;min-width:70px;text-align:right;font-weight:700">${Storage.fmt(item.precioUnitario * item.cantidad)}</span>
          <button class="btn btn-ghost btn-sm" onclick="Ventas._quitarItem(${idx})" style="padding:4px 6px">✕</button>
        </div>
      </div>`).join('');
    if (tot) tot.textContent = Storage.fmt(total);
  },

  _cambiarCant(idx, delta) {
    const item = this._carrito[idx];
    if (!item) return;
    const nueva = item.cantidad + delta;
    if (nueva <= 0) { this._carrito.splice(idx, 1); }
    else if (nueva > item.stockMax) { App.toast('Sin stock suficiente', 'warning'); return; }
    else { item.cantidad = nueva; }
    this._renderCarritoItems();
  },

  _quitarItem(idx) { this._carrito.splice(idx, 1); this._renderCarritoItems(); },

  guardarVenta() {
    const clienteId = document.getElementById('cart-cli')?.value;
    if (!clienteId) { App.toast('Selecciona un cliente', 'error'); return; }
    if (!this._carrito.length) { App.toast('El carrito está vacío', 'error'); return; }
    const cliente  = Storage.getCliente(clienteId);
    const total    = this._carrito.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
    const pagado   = parseFloat(document.getElementById('cart-pagado')?.value) || 0;
    const notas    = document.getElementById('cart-notas')?.value.trim() || '';

    // Descontar stock
    this._carrito.forEach(item => {
      const p = Storage.getProducto(item.productoId);
      if (p) {
        p.stock = Math.max(0, (p.stock || 0) - item.cantidad);
        if (p.stock === 0) p.estado = 'agotado';
        Storage.saveProducto(p);
      }
    });

    Storage.saveVenta({
      clienteId,
      clienteNombre: cliente?.nombre || '',
      items:         this._carrito.map(i => ({ productoId:i.productoId, nombre:i.nombre, cantidad:i.cantidad, precioUnitario:i.precioUnitario })),
      total,
      pagadoInicial: pagado,
      notas
    });

    this._carrito = [];
    App.closeModal();
    App.toast('Pedido registrado exitosamente', 'success');
    this.render();
  },

  // ── Abono ──
  openAbono(ventaId) {
    const v    = Storage.getVenta(ventaId);
    const saldo= Storage.getSaldoVenta(ventaId);
    const abonos = Storage.getAbonosByVenta(ventaId);

    App.openModal('💵 Registrar Abono', `
      <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-secondary);font-size:13px">Total venta</span>
          <span style="font-weight:700">${Storage.fmt(v?.total)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-secondary);font-size:13px">Pagado inicial</span>
          <span>${Storage.fmt(v?.pagadoInicial)}</span>
        </div>
        ${abonos.map(a => `
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px">
            <span style="color:var(--text-secondary)">Abono ${Storage.fmtDate(a.fecha)}</span>
            <span>${Storage.fmt(a.monto)}</span>
          </div>`).join('')}
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between">
          <span style="font-weight:700;color:var(--danger)">Saldo pendiente</span>
          <span style="font-weight:700;color:var(--danger);font-size:16px">${Storage.fmt(saldo)}</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Monto a abonar *</label>
          <input class="form-control" id="ab-monto" type="number" step="0.01" min="0.01" max="${saldo}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input class="form-control" id="ab-fecha" type="date" value="${Storage.today()}">
        </div>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <input class="form-control" id="ab-notas" placeholder="Transferencia, efectivo...">
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="Ventas.saveAbono('${ventaId}','${v?.clienteId}')">💾 Registrar Abono</button>
      </div>`);
  },

  saveAbono(ventaId, clienteId) {
    const monto = parseFloat(document.getElementById('ab-monto')?.value);
    if (!monto || monto <= 0) { App.toast('Ingresa un monto válido', 'error'); return; }
    const saldo = Storage.getSaldoVenta(ventaId);
    if (monto > saldo + 0.01) { App.toast(`El abono no puede superar el saldo (${Storage.fmt(saldo)})`, 'warning'); return; }

    Storage.saveAbono({
      ventaId,
      clienteId,
      monto,
      fecha: document.getElementById('ab-fecha')?.value || Storage.today(),
      notas: document.getElementById('ab-notas')?.value.trim() || ''
    });

    App.closeModal();
    App.toast('Abono registrado', 'success');
    this.render();
  },

  verDetalle(ventaId) {
    const v = Storage.getVenta(ventaId);
    if (!v) return;
    const abonos = Storage.getAbonosByVenta(ventaId);
    const saldo  = Storage.getSaldoVenta(ventaId);

    App.openModal(`Pedido Cliente — ${v.clienteNombre}`, `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">📅 ${Storage.fmtDate(v.fecha)} · Cliente: ${v.clienteNombre}</div>
        ${(v.items||[]).map(i => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span>${i.nombre} × ${i.cantidad}</span>
            <strong>${Storage.fmt(i.precioUnitario * i.cantidad)}</strong>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:700">
          <span>Total</span><span>${Storage.fmt(v.total)}</span>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>Pagado inicial</span><span>${Storage.fmt(v.pagadoInicial)}</span>
        </div>
        ${abonos.map(a => `
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px">
            <span style="color:var(--text-secondary)">Abono ${Storage.fmtDate(a.fecha)}${a.notas?' · '+a.notas:''}</span>
            <span>${Storage.fmt(a.monto)}</span>
          </div>`).join('')}
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700">
          <span style="color:${saldo>0?'var(--danger)':'var(--success)'}">Saldo pendiente</span>
          <span style="color:${saldo>0?'var(--danger)':'var(--success)'}">${Storage.fmt(saldo)}</span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
        ${saldo > 0 ? `<button class="btn btn-success" onclick="App.closeModal();Ventas.openAbono('${ventaId}')">💵 Abonar</button>` : ''}
      </div>`, true);
  }
};
