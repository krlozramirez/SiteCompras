const Importaciones = {
  ESTADOS: ['pedido', 'en transporte', 'entregado'],
  COLORES: { 'pedido':'#6366f1', 'en transporte':'#f59e0b', 'entregado':'#10b981' },
  _itemsForm: [],

  render() {
    const lista   = Storage.getImportaciones().sort((a,b) => new Date(b.fechaOrden)-new Date(a.fechaOrden));
    const invTotal = lista.reduce((s,p)=>s+this._totalPedido(p),0);
    const enCurso  = lista.filter(p => p.estado !== 'entregado').length;

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📦 Pedidos Amazon</h1>
          <p class="page-subtitle">${lista.length} pedidos · ${enCurso} en curso</p>
        </div>
        <button class="btn btn-primary" onclick="Importaciones.openForm()">+ Nuevo Pedido</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${lista.length}</div></div>
        <div class="stat-card"><div class="stat-label">En Curso</div><div class="stat-value" style="color:var(--warning)">${enCurso}</div></div>
        <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value" style="color:var(--success)">${lista.filter(p=>p.estado==='entregado').length}</div></div>
        <div class="stat-card"><div class="stat-label">Inversión Total</div><div class="stat-value" style="font-size:18px">${Storage.fmt(invTotal)}</div></div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input type="text" class="search-input" id="imp-q" placeholder="Buscar nombre, descripción..." oninput="Importaciones.filter()">
          <select class="form-control" style="width:auto" id="imp-est" onchange="Importaciones.filter()">
            <option value="">Todos los estados</option>
            ${this.ESTADOS.map(e=>`<option>${e}</option>`).join('')}
          </select>
        </div>
        <div id="imp-list">${this._renderList(lista)}</div>
      </div>`;
  },

  // Suma todos los costos del pedido
  _totalPedido(imp) {
    return (parseFloat(imp.valorAmazon)||0)
         + (parseFloat(imp.valorCourier)||0)
         + (parseFloat(imp.costoEnvio)||0)
         + (parseFloat(imp.impuestos)||0);
  },

  _renderList(lista) {
    if (!lista.length) return `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>Sin pedidos Amazon</h3>
        <p>Crea primero los productos en Inventario, luego agrúpalos en un pedido Amazon</p>
      </div>`;

    return lista.map(imp => {
      const idx   = this.ESTADOS.indexOf(imp.estado);
      const items = imp.productos || [];
      const total = this._totalPedido(imp);

      return `
        <div class="import-card" style="border-left-color:${this.COLORES[imp.estado]||'#94a3b8'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
                <span style="font-size:16px;font-weight:700">${imp.nombre||'Sin nombre'}</span>
                ${this._badge(imp.estado)}
                <span style="font-size:12px;color:var(--text-secondary)">${items.length} producto(s)</span>
              </div>
              ${imp.descripcion ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">${imp.descripcion}</div>` : ''}
              <div style="font-size:12px;color:var(--text-secondary)">
                📅 Orden: ${Storage.fmtDate(imp.fechaOrden)}
                ${imp.fechaEntregado ? ` · ✅ Entregado: ${Storage.fmtDate(imp.fechaEntregado)}` : ''}
                ${imp.notas ? ` · ${imp.notas}` : ''}
              </div>

              ${items.length ? `
              <div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap">
                ${items.slice(0,6).map(i => {
                  const p = Storage.getProducto(i.productoId);
                  return `<div style="display:flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px">
                    ${p?.foto ? `<img src="${p.foto}" style="width:18px;height:18px;border-radius:3px;object-fit:cover">` : '📦'}
                    <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p?.nombre||item.nombre||'(eliminado)'}</span>
                    <span style="color:var(--text-secondary)">×${i.unidades}</span>
                  </div>`;
                }).join('')}
                ${items.length > 6 ? `<div style="font-size:11px;color:var(--text-secondary);padding:4px">+${items.length-6} más</div>` : ''}
              </div>` : `<div style="margin-top:8px;font-size:12px;color:var(--warning)">⚠️ Sin productos asignados</div>`}
            </div>

            <div style="text-align:right;flex-shrink:0;min-width:160px">
              <div style="font-size:12px;color:var(--text-secondary)">Peso: <strong>${imp.pesoTotal||0} lbs</strong></div>
              <div style="font-size:12px;color:var(--text-secondary)">Amazon: ${Storage.fmt(imp.valorAmazon)}</div>
              <div style="font-size:12px;color:var(--text-secondary)">Courier: ${Storage.fmt(imp.valorCourier)}</div>
              ${parseFloat(imp.costoEnvio||0)>0 ? `<div style="font-size:12px;color:var(--text-secondary)">Envío: ${Storage.fmt(imp.costoEnvio)}</div>` : ''}
              ${parseFloat(imp.impuestos||0)>0  ? `<div style="font-size:12px;color:var(--text-secondary)">Impuestos: ${Storage.fmt(imp.impuestos)}</div>` : ''}
              <div style="font-size:15px;font-weight:700;color:var(--primary);margin-top:4px">Total: ${Storage.fmt(total)}</div>
            </div>
          </div>

          <div class="timeline">
            ${this.ESTADOS.map((e,i) => `
              <div class="step ${i<idx?'done':i===idx?'active':''}">
                <div class="step-dot">${i<idx?'✓':i+1}</div>
                <div class="step-label">${e}</div>
              </div>`).join('')}
          </div>

          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            ${imp.estado !== 'entregado' ? `
              <button class="btn btn-success btn-sm" onclick="Importaciones.confirmarEntregar('${imp.id}')">✅ Marcar entregado</button>
              <button class="btn btn-outline btn-sm" onclick="Importaciones.avanzar('${imp.id}')">Avanzar estado →</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="Importaciones.openForm('${imp.id}')">✏️ Editar</button>
            ${imp.estado === 'entregado' ? `<button class="btn btn-ghost btn-sm" onclick="Importaciones.verResumen('${imp.id}')">📋 Resumen</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="Importaciones.del('${imp.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  },

  _badge(e) {
    const m = { 'pedido':'info', 'en transporte':'warning', 'entregado':'success' };
    return `<span class="badge badge-${m[e]||'secondary'}">${e}</span>`;
  },

  filter() {
    const q   = (document.getElementById('imp-q')?.value  ||'').toLowerCase();
    const est = document.getElementById('imp-est')?.value ||'';
    let lista = Storage.getImportaciones().sort((a,b)=>new Date(b.fechaOrden)-new Date(a.fechaOrden));
    if (q)   lista = lista.filter(p=>`${p.nombre}${p.descripcion}`.toLowerCase().includes(q));
    if (est) lista = lista.filter(p=>p.estado===est);
    document.getElementById('imp-list').innerHTML = this._renderList(lista);
  },

  avanzar(id) {
    const p = Storage.getImportacion(id);
    if (!p) return;
    const i = this.ESTADOS.indexOf(p.estado);
    if (i < this.ESTADOS.length-1) {
      p.estado = this.ESTADOS[i+1];
      Storage.saveImportacion(p);
      App.toast(`Estado: ${p.estado}`, 'success');
      this.render();
    }
  },

  // ─── Formulario ─────────────────────────────────────────────────────────────
  openForm(id) {
    const imp = id ? (Storage.getImportacion(id)||{}) : {};
    const cfg = Storage.getConfig();
    this._itemsForm = JSON.parse(JSON.stringify(imp.productos||[]));

    App.openModal(id ? 'Editar Pedido Amazon' : 'Nuevo Pedido Amazon', `
      <div class="form-row">
        <div class="form-group">
          <label>Nombre del pedido *</label>
          <input class="form-control" id="f-nom" placeholder="Ej: Pedido Mayo 2025" value="${imp.nombre||''}">
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select class="form-control" id="f-est">
            ${this.ESTADOS.map(e=>`<option ${(imp.estado||'pedido')===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Fecha del pedido *</label>
          <input class="form-control" id="f-ford" type="date" value="${imp.fechaOrden||Storage.today()}">
        </div>
        <div class="form-group">
          <label>Notas / N° seguimiento courier</label>
          <input class="form-control" id="f-notas" placeholder="Número de tracking, observaciones..." value="${imp.notas||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Descripción</label>
        <input class="form-control" id="f-desc" placeholder="Descripción opcional del pedido" value="${imp.descripcion||''}">
      </div>

      <!-- Productos del pedido -->
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Productos en este pedido</div>
          <button class="btn btn-outline btn-sm" onclick="Importaciones._abrirSelectorProducto()">+ Agregar producto</button>
        </div>
        <div id="f-items-list">${this._renderItemsForm()}</div>
      </div>

      <!-- Costos del pedido -->
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Costos del pedido</div>
        <div class="form-row-3">
          <div class="form-group" style="margin-bottom:0">
            <label>Peso total (lbs)</label>
            <input class="form-control" id="f-peso-total" readonly style="background:#fff;font-weight:700" value="${imp.pesoTotal||0}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Tarifa courier (USD / lb)</label>
            <input class="form-control" id="f-tarifa" type="number" step="0.01" min="0" value="${imp.tarifaCourier||cfg.tarifaCourier||8}" oninput="Importaciones._recalcCourier()">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Courier total</label>
            <input class="form-control" id="f-courier" type="number" step="0.01" min="0" placeholder="Auto" value="${imp.valorCourier||''}">
          </div>
        </div>
        <div class="form-row" style="margin-top:10px">
          <div class="form-group" style="margin-bottom:0">
            <label>Costo de envío (USD)</label>
            <input class="form-control" id="f-envio" type="number" step="0.01" min="0" placeholder="0.00" value="${imp.costoEnvio||''}" oninput="Importaciones._recalcTotales()">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Cargo de Amazon/flete adicional</div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Impuestos / Aduana (USD)</label>
            <input class="form-control" id="f-imp" type="number" step="0.01" min="0" placeholder="0.00" value="${imp.impuestos||''}" oninput="Importaciones._recalcTotales()">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Se distribuirá entre productos al recibir</div>
          </div>
        </div>
      </div>

      <!-- Resumen totales -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        <div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">Productos</div>
          <div id="f-sum-prods" style="font-size:20px;font-weight:700">${this._itemsForm.length}</div>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">Amazon</div>
          <div id="f-sum-amz" style="font-size:16px;font-weight:700">${Storage.fmt(imp.valorAmazon||0)}</div>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">+ Courier/Envío/Imp.</div>
          <div id="f-sum-extra" style="font-size:16px;font-weight:700">${Storage.fmt((parseFloat(imp.valorCourier)||0)+(parseFloat(imp.costoEnvio)||0)+(parseFloat(imp.impuestos)||0))}</div>
        </div>
        <div style="background:#e0e7ff;border-radius:8px;padding:10px;text-align:center;border:2px solid var(--primary)">
          <div style="font-size:10px;color:var(--primary);font-weight:700;text-transform:uppercase">Total</div>
          <div id="f-sum-total" style="font-size:16px;font-weight:700;color:var(--primary)">${Storage.fmt(this._totalPedido(imp))}</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Importaciones.save('${id||''}')">💾 Guardar</button>
      </div>`, true);

    this._recalcTotales();
  },

  _renderItemsForm() {
    if (!this._itemsForm.length) return `<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:10px">Sin productos. Usa "+ Agregar producto"</p>`;
    return `<div class="table-wrapper"><table>
      <thead><tr><th>Producto</th><th>Uds en este pedido</th><th>Peso/ud (lbs)</th><th>Peso total</th><th>Costo Amazon</th><th></th></tr></thead>
      <tbody>
        ${this._itemsForm.map((item,idx) => {
          const p     = Storage.getProducto(item.productoId);
          const pesoT = (parseFloat(item.pesoUd)||0) * (parseInt(item.unidades)||1);
          const amzT  = (parseFloat(item.costoAmzUd)||0) * (parseInt(item.unidades)||1);
          return `<tr>
            <td style="font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${p?.nombre||item.nombre||'(eliminado)'}</td>
            <td><input type="number" min="1" value="${item.unidades||1}" style="width:60px;padding:4px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:13px" onchange="Importaciones._editItem(${idx},'unidades',this.value)"></td>
            <td><input type="number" step="0.01" min="0" value="${item.pesoUd||0}" style="width:70px;padding:4px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:13px" onchange="Importaciones._editItem(${idx},'pesoUd',this.value)"></td>
            <td style="font-weight:700">${pesoT.toFixed(2)} lbs</td>
            <td>${Storage.fmt(amzT)}</td>
            <td><button class="btn btn-ghost btn-sm" style="padding:3px 7px" onclick="Importaciones._removeItem(${idx})">✕</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  _abrirSelectorProducto() {
    const yaAgregados = new Set(this._itemsForm.map(i => i.productoId));
    const disponibles = Storage.getProductos().filter(p => !yaAgregados.has(p.id));

    if (!disponibles.length) { App.toast('No hay más productos para agregar', 'info'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'sel-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.25)">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);font-size:16px;font-weight:700">Seleccionar producto</div>
      <div style="padding:18px 22px">
        <div style="margin-bottom:12px">
          <input type="text" class="search-input" style="width:100%" id="sel-q" placeholder="Buscar producto..." oninput="Importaciones._filtrarSelector()">
        </div>
        <div id="sel-list" style="max-height:320px;overflow-y:auto">${this._renderSelectorList(disponibles)}</div>
        <div class="modal-footer" style="margin-top:12px">
          <button class="btn btn-ghost" onclick="Importaciones._cerrarSelector()">Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    window._selDisponibles = disponibles;
  },

  _renderSelectorList(lista) {
    if (!lista.length) return `<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px">Sin productos</p>`;
    return lista.map(p => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;border:1.5px solid var(--border);margin-bottom:8px;cursor:pointer;transition:border-color .15s"
           onclick="Importaciones._seleccionar('${p.id}')"
           onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
        ${p.foto ? `<img src="${p.foto}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0">` : '<div style="width:44px;height:44px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📦</div>'}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nombre}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${p.categoria||''} · ${p.peso||0} lbs/ud · ${p.unidadesCompradas||1} uds · ${Storage.fmt(p.costoAmazon)}/ud</div>
          <div style="font-size:11px">${Inventario._trackingBadge(p.trackingStatus||'pedido')}</div>
        </div>
      </div>`).join('');
  },

  _filtrarSelector() {
    const q = (document.getElementById('sel-q')?.value||'').toLowerCase();
    const lista = (window._selDisponibles||[]).filter(p =>
      `${p.nombre}${p.categoria}`.toLowerCase().includes(q));
    const el = document.getElementById('sel-list');
    if (el) el.innerHTML = this._renderSelectorList(lista);
  },

  _seleccionar(productoId) {
    const p = Storage.getProducto(productoId);
    if (!p) return;
    this._itemsForm.push({
      productoId,
      nombre:    p.nombre,
      unidades:  p.unidadesCompradas || 1,
      pesoUd:    p.peso || 0,
      pesoTotal: (parseFloat(p.peso)||0) * (parseInt(p.unidadesCompradas)||1),
      costoAmzUd:p.costoAmazon || 0
    });
    this._cerrarSelector();
    this._refreshItemsForm();
  },

  _cerrarSelector() {
    const el = document.getElementById('sel-overlay');
    if (el) el.remove();
    window._selDisponibles = [];
  },

  _editItem(idx, campo, valor) {
    if (!this._itemsForm[idx]) return;
    this._itemsForm[idx][campo] = parseFloat(valor) || parseInt(valor) || valor;
    const item = this._itemsForm[idx];
    item.pesoTotal = (parseFloat(item.pesoUd)||0) * (parseInt(item.unidades)||1);
    this._recalcTotales();
    const el = document.getElementById('f-items-list');
    if (el) el.innerHTML = this._renderItemsForm();
  },

  _removeItem(idx) {
    this._itemsForm.splice(idx, 1);
    this._refreshItemsForm();
  },

  _refreshItemsForm() {
    const el = document.getElementById('f-items-list');
    if (el) el.innerHTML = this._renderItemsForm();
    this._recalcTotales();
  },

  _recalcTotales() {
    const pesoTotal  = this._itemsForm.reduce((s,i)=>s+(parseFloat(i.pesoTotal)||0),0);
    const amzTotal   = this._itemsForm.reduce((s,i)=>s+(parseFloat(i.costoAmzUd)||0)*(parseInt(i.unidades)||1),0);
    const tarifa     = parseFloat(document.getElementById('f-tarifa')?.value)||0;
    const courierAuto = pesoTotal * tarifa;

    const ep = document.getElementById('f-peso-total'); if (ep) ep.value = pesoTotal.toFixed(2);
    const ec = document.getElementById('f-courier');
    if (ec && !ec.dataset.manual) ec.value = courierAuto.toFixed(2);

    const courier   = parseFloat(document.getElementById('f-courier')?.value) || courierAuto;
    const costoEnvio = parseFloat(document.getElementById('f-envio')?.value) || 0;
    const impuestos  = parseFloat(document.getElementById('f-imp')?.value)   || 0;
    const extra      = courier + costoEnvio + impuestos;

    const es = document.getElementById('f-sum-prods'); if (es) es.textContent = this._itemsForm.length;
    const ea = document.getElementById('f-sum-amz');   if (ea) ea.textContent = Storage.fmt(amzTotal);
    const ex = document.getElementById('f-sum-extra'); if (ex) ex.textContent = Storage.fmt(extra);
    const et = document.getElementById('f-sum-total'); if (et) et.textContent = Storage.fmt(amzTotal + extra);
  },

  _recalcCourier() {
    const el = document.getElementById('f-courier');
    if (el) el.dataset.manual = '';
    this._recalcTotales();
  },

  save(id) {
    const nom = document.getElementById('f-nom')?.value.trim();
    if (!nom) { App.toast('El nombre es obligatorio', 'error'); return; }
    if (!this._itemsForm.length) { App.toast('Agrega al menos un producto al pedido', 'error'); return; }

    const pesoTotal  = this._itemsForm.reduce((s,i)=>s+(parseFloat(i.pesoTotal)||0),0);
    const amzTotal   = this._itemsForm.reduce((s,i)=>s+(parseFloat(i.costoAmzUd)||0)*(parseInt(i.unidades)||1),0);
    const courier    = parseFloat(document.getElementById('f-courier')?.value) || 0;
    const tarifa     = parseFloat(document.getElementById('f-tarifa')?.value)  || 0;
    const costoEnvio = parseFloat(document.getElementById('f-envio')?.value)   || 0;
    const impuestos  = parseFloat(document.getElementById('f-imp')?.value)     || 0;
    const existing   = id ? Storage.getImportacion(id) : null;

    Storage.saveImportacion({
      id,
      nombre:       nom,
      descripcion:  document.getElementById('f-desc')?.value.trim()  ||'',
      estado:       document.getElementById('f-est')?.value          ||'pedido',
      fechaOrden:   document.getElementById('f-ford')?.value         ||Storage.today(),
      fechaEntregado: existing?.fechaEntregado || '',
      notas:        document.getElementById('f-notas')?.value.trim() ||'',
      productos:    this._itemsForm.map(i=>({
        productoId: i.productoId,
        nombre:     i.nombre,
        unidades:   parseInt(i.unidades)||1,
        pesoUd:     parseFloat(i.pesoUd)||0,
        pesoTotal:  parseFloat(i.pesoTotal)||0,
        costoAmzUd: parseFloat(i.costoAmzUd)||0
      })),
      pesoTotal:    Math.round(pesoTotal   * 100) / 100,
      valorAmazon:  Math.round(amzTotal    * 100) / 100,
      tarifaCourier: tarifa,
      valorCourier: courier,
      costoEnvio:   costoEnvio,
      impuestos:    impuestos
    });

    this._itemsForm = [];
    App.closeModal();
    App.toast(id ? 'Pedido actualizado' : 'Pedido registrado', 'success');
    this.render();
  },

  // ─── Marcar entregado ────────────────────────────────────────────────────────
  confirmarEntregar(id) {
    const imp   = Storage.getImportacion(id);
    const items = imp?.productos || [];
    if (!items.length) { App.toast('No hay productos en este pedido', 'warning'); return; }

    const pesoTotal  = items.reduce((s,i)=>s+parseFloat(i.pesoTotal||0),0);
    const totalExtra = (parseFloat(imp.valorCourier)||0)
                     + (parseFloat(imp.costoEnvio)||0)
                     + (parseFloat(imp.impuestos)||0);
    const cfg = Storage.getConfig();

    const preview = items.map(i => {
      const p        = Storage.getProducto(i.productoId);
      const pesoItem = parseFloat(i.pesoTotal||0);
      const extProp  = pesoTotal > 0 ? (pesoItem / pesoTotal) * totalExtra : 0;
      const uds      = parseInt(i.unidades) || 1;
      const extUnit  = uds > 0 ? extProp / uds : 0;
      const amzUd    = parseFloat(p?.costoAmazon || i.costoAmzUd || 0);
      const inv      = amzUd + extUnit;
      const pct      = parseFloat(p?.porcentajeGanancia) || (cfg.porcentajeDefault || 40);
      return { nombre: p?.nombre||i.nombre, uds, extUnit, inv, pventa: inv*(1+pct/100) };
    });

    const costoEnvioFmt  = Storage.fmt(imp.costoEnvio||0);
    const impuestosFmt   = Storage.fmt(imp.impuestos||0);
    const courierFmt     = Storage.fmt(imp.valorCourier||0);

    App.openModal('✅ Confirmar entrega del pedido', `
      <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text-secondary)">Courier</span><strong>${courierFmt}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text-secondary)">Costo de envío</span><strong>${costoEnvioFmt}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--text-secondary)">Impuestos / Aduana</span><strong>${impuestosFmt}</strong></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px"><span style="font-weight:700">Total distribuir</span><strong style="color:var(--primary)">${Storage.fmt(totalExtra)}</strong></div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Se distribuirá proporcionalmente por peso entre todos los productos</div>
      </div>
      <div style="max-height:240px;overflow-y:auto;margin-bottom:14px">
        <div class="table-wrapper"><table>
          <thead><tr><th>Producto</th><th>Uds</th><th>Adicional/ud</th><th>Inversión/ud</th><th>Precio Venta</th></tr></thead>
          <tbody>
            ${preview.map(r=>`
              <tr>
                <td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.nombre}</td>
                <td>${r.uds}</td>
                <td>${Storage.fmt(r.extUnit)}</td>
                <td>${Storage.fmt(r.inv)}</td>
                <td style="font-weight:700;color:var(--primary)">${Storage.fmt(r.pventa)}</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px">
        ✅ Se agregarán <strong>${preview.reduce((s,r)=>s+r.uds,0)} unidades</strong> al stock y se actualizarán costos
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="Importaciones._entregarConfirmado('${id}')">✅ Confirmar y actualizar stock</button>
      </div>`, true);
  },

  _entregarConfirmado(id) {
    Storage.recibirImportacion(id);
    App.closeModal();
    App.toast('¡Pedido entregado! Stock e inversión actualizados.', 'success');
    this.render();
  },

  verResumen(id) {
    const imp   = Storage.getImportacion(id);
    const items = imp?.productos || [];
    const total = this._totalPedido(imp);

    App.openModal(`📋 Resumen — ${imp?.nombre||'Pedido'}`, `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">Productos</div>
          <div style="font-size:20px;font-weight:700">${items.length}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">Amazon</div>
          <div style="font-size:16px;font-weight:700">${Storage.fmt(imp?.valorAmazon)}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);font-weight:700;text-transform:uppercase">Courier</div>
          <div style="font-size:16px;font-weight:700">${Storage.fmt(imp?.valorCourier)}</div>
        </div>
        <div style="background:#e0e7ff;border-radius:8px;padding:10px;text-align:center;border:2px solid var(--primary)">
          <div style="font-size:10px;color:var(--primary);font-weight:700;text-transform:uppercase">Total</div>
          <div style="font-size:16px;font-weight:700;color:var(--primary)">${Storage.fmt(total)}</div>
        </div>
      </div>
      ${parseFloat(imp?.costoEnvio||0)>0 || parseFloat(imp?.impuestos||0)>0 ? `
      <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;display:flex;gap:20px">
        ${parseFloat(imp?.costoEnvio||0)>0 ? `<span>Costo envío: <strong>${Storage.fmt(imp.costoEnvio)}</strong></span>` : ''}
        ${parseFloat(imp?.impuestos||0)>0  ? `<span>Impuestos: <strong>${Storage.fmt(imp.impuestos)}</strong></span>` : ''}
      </div>` : ''}
      <div class="table-wrapper"><table>
        <thead><tr><th>Producto</th><th>Uds</th><th>Peso total</th><th>Amazon/ud</th><th>Adicional/ud</th><th>Inversión/ud</th><th>Precio Venta</th></tr></thead>
        <tbody>
          ${items.map(i => {
            const p = Storage.getProducto(i.productoId);
            return `<tr>
              <td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p?.nombre||i.nombre}</td>
              <td>${i.unidades}</td>
              <td>${i.pesoTotal} lbs</td>
              <td>${Storage.fmt(i.costoAmzUd)}</td>
              <td>${Storage.fmt(p?.costoCourier)}</td>
              <td>${Storage.fmt(p?.inversionTotal)}</td>
              <td style="font-weight:700;color:var(--primary)">${Storage.fmt(p?.precioVenta)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
      </div>`, true);
  },

  del(id) {
    const p = Storage.getImportacion(id);
    App.confirm(`¿Eliminar pedido "${p?.nombre||'sin nombre'}"?`, () => {
      Storage.deleteImportacion(id);
      App.toast('Pedido eliminado', 'success');
      this.render();
    });
  }
};
