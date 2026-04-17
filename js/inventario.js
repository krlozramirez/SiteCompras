const Inventario = {
  TRACKING: ['pedido', 'enviado', 'en aduana', 'en bodega', 'recibido'],

  render() {
    const todos       = Storage.getProductos();
    const enStock     = todos.filter(p => p.estado === 'disponible');
    const pendientes  = todos.filter(p => p.estado !== 'disponible' && p.estado !== 'agotado');
    const invStock    = enStock.reduce((s,p) => s + (parseFloat(p.inversionTotal)||0)*(parseInt(p.stock)||0), 0);

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📦 Inventario</h1>
          <p class="page-subtitle">${todos.length} productos registrados</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="file" id="inv-import-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="Inventario.importarExcel(this)">
          <button class="btn btn-outline" onclick="Inventario._plantillaProductos()">⬇️ Plantilla</button>
          <button class="btn btn-outline" onclick="document.getElementById('inv-import-file').click()">⬆️ Importar Excel</button>
          <button class="btn btn-primary" onclick="Inventario.openForm()">+ Nuevo Producto</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">En Stock</div>
          <div class="stat-value" style="color:var(--success)">${enStock.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">En camino / Pendiente</div>
          <div class="stat-value" style="color:var(--warning)">${pendientes.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unidades disponibles</div>
          <div class="stat-value">${enStock.reduce((s,p)=>s+(parseInt(p.stock)||0),0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Inversión en Stock</div>
          <div class="stat-value" style="font-size:18px">${Storage.fmt(invStock)}</div>
        </div>
      </div>

      ${pendientes.length ? `
      <div class="card" style="border-left:4px solid var(--warning)">
        <div class="card-header">
          <div class="card-title">⏳ Productos en seguimiento</div>
          <span style="font-size:12px;color:var(--text-secondary)">Actualiza el estado de cada producto conforme avanza</span>
        </div>
        <div class="table-wrapper"><table>
          <thead><tr>
            <th>Foto</th><th>Nombre</th><th>Categoría</th>
            <th>Cód. Importación</th><th>Costo Amazon</th><th>Peso/ud</th><th>Uds compradas</th>
            <th>Tracking</th><th></th>
          </tr></thead>
          <tbody>
            ${pendientes.map(p => `
              <tr>
                <td>${p.foto ? `<img src="${p.foto}" class="product-thumb">` : '<div class="product-thumb">📦</div>'}</td>
                <td>
                  <div style="font-weight:600">${p.nombre}</div>
                  ${p.descripcion ? `<div style="font-size:11px;color:var(--text-secondary)">${p.descripcion.substr(0,40)}</div>` : ''}
                </td>
                <td>${p.categoria||'-'}</td>
                <td style="font-size:12px;color:var(--text-secondary)">${p.codigoImportacion||'-'}</td>
                <td>${Storage.fmt(p.costoAmazon)}</td>
                <td>${p.peso||0} lbs</td>
                <td>${p.unidadesCompradas||1}</td>
                <td>${this._trackingBadge(p.trackingStatus)}</td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${this._trackingBtns(p)}
                    <button class="btn btn-ghost btn-sm" onclick="Inventario.openForm('${p.id}')">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="Inventario.del('${p.id}')">🗑️</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : ''}

      <div class="card">
        <div class="card-header">
          <div class="card-title">Disponibles para venta</div>
        </div>
        <div class="toolbar">
          <input type="text" class="search-input" id="inv-q" placeholder="Buscar nombre, categoría..." oninput="Inventario.filter()">
          <select class="form-control" style="width:auto" id="inv-cat" onchange="Inventario.filter()">
            <option value="">Todas las categorías</option>
            ${[...new Set(enStock.map(p=>p.categoria).filter(Boolean))].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div id="inv-body">${this._table(enStock)}</div>
      </div>`;
  },

  _table(prods) {
    if (!prods.length) return `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>Sin productos en stock</h3>
        <p>Los productos llegan aquí cuando la importación es marcada como recibida</p>
      </div>`;

    return `<div class="table-wrapper"><table>
      <thead><tr>
        <th>Foto</th><th>Nombre</th><th>Categoría</th>
        <th>Inversión</th><th>% Gan.</th><th>Precio Venta</th>
        <th>Stock</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        ${prods.map(p => `
          <tr>
            <td>${p.foto ? `<img src="${p.foto}" class="product-thumb" alt="">` : '<div class="product-thumb">📦</div>'}</td>
            <td>
              <div style="font-weight:600;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre}</div>
              ${p.descripcion ? `<div style="font-size:11px;color:var(--text-secondary)">${p.descripcion.substr(0,40)}</div>` : ''}
            </td>
            <td>${p.categoria||'-'}</td>
            <td>
              <div>${Storage.fmt(p.inversionTotal)}</div>
              <div style="font-size:10px;color:var(--text-secondary)">Amz: ${Storage.fmt(p.costoAmazon)} · Cour: ${Storage.fmt(p.costoCourier)}</div>
            </td>
            <td>${p.porcentajeGanancia||0}%</td>
            <td><strong>${Storage.fmt(p.precioVenta)}</strong></td>
            <td><span style="font-weight:700;color:${(p.stock||0)<=0?'var(--danger)':(p.stock||0)<=3?'var(--warning)':'var(--success)'}">${p.stock||0}</span></td>
            <td>${this._badgeEstado(p.estado)}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" onclick="Inventario.openForm('${p.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="Inventario.del('${p.id}')">🗑️</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;
  },

  _badgeEstado(e) {
    const m = { disponible:'success', agotado:'danger', reservado:'warning', pendiente:'secondary' };
    return `<span class="badge badge-${m[e]||'secondary'}">${e||'-'}</span>`;
  },

  _trackingBadge(s) {
    const m = { pedido:'info', enviado:'purple', 'en aduana':'danger', 'en bodega':'warning', recibido:'success' };
    return `<span class="badge badge-${m[s]||'secondary'}">${s||'pedido'}</span>`;
  },

  _trackingBtns(p) {
    const estados = this.TRACKING;
    const idx     = estados.indexOf(p.trackingStatus || 'pedido');
    if (idx >= estados.length - 1) return '';
    const siguiente = estados[idx + 1];
    return `<button class="btn btn-outline btn-sm" onclick="Inventario.avanzarTracking('${p.id}')" title="Marcar como: ${siguiente}">→ ${siguiente}</button>`;
  },

  avanzarTracking(id) {
    const p   = Storage.getProducto(id);
    if (!p) return;
    const idx = this.TRACKING.indexOf(p.trackingStatus || 'pedido');
    if (idx < this.TRACKING.length - 1) {
      p.trackingStatus = this.TRACKING[idx + 1];
      if (p.trackingStatus === 'recibido') {
        p.stock  = (parseInt(p.stock) || 0) + (parseInt(p.unidadesCompradas) || 1);
        p.estado = 'disponible';
      }
      Storage.saveProducto(p);
      App.toast(`Tracking: ${p.trackingStatus}`, 'success');
      this.render();
    }
  },

  filter() {
    const q   = (document.getElementById('inv-q')?.value   || '').toLowerCase();
    const cat = document.getElementById('inv-cat')?.value  || '';
    let p = Storage.getProductos().filter(x => x.estado === 'disponible');
    if (q)   p = p.filter(x => `${x.nombre}${x.categoria}${x.descripcion}`.toLowerCase().includes(q));
    if (cat) p = p.filter(x => x.categoria === cat);
    document.getElementById('inv-body').innerHTML = this._table(p);
  },

  openForm(id) {
    const p   = id ? (Storage.getProducto(id) || {}) : {};
    const cfg = Storage.getConfig();
    const pctDef = cfg.porcentajeDefault || 40;
    window._fotoActual = p.foto || null;

    App.openModal(id ? 'Editar Producto' : 'Nuevo Producto', `
      <div class="form-group">
        <label>Foto del producto</label>
        <div class="photo-upload" onclick="document.getElementById('foto-inp').click()">
          <input type="file" id="foto-inp" accept="image/*" style="display:none" onchange="Inventario._previewFoto(this)">
          <div id="foto-wrap">
            ${p.foto
              ? `<img src="${p.foto}" class="photo-preview">`
              : `<div style="font-size:32px">📷</div><div style="font-size:12px;margin-top:4px">Clic para subir foto</div>`}
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Nombre *</label>
          <input class="form-control" id="f-nom" placeholder="Ej: Conjunto niña Carter's talla 4T" value="${p.nombre||''}">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <input class="form-control" id="f-cat" placeholder="Ej: Ropa niña" value="${p.categoria||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Descripción</label>
        <textarea class="form-control" id="f-desc" rows="2" placeholder="Talla, color, características...">${p.descripcion||''}</textarea>
      </div>

      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Datos de compra Amazon</div>
        <div class="form-row-3">
          <div class="form-group" style="margin-bottom:0">
            <label>Costo unitario (USD) *</label>
            <input class="form-control" id="f-amz" type="number" step="0.01" min="0" placeholder="0.00" value="${p.costoAmazon||''}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Peso por unidad (lbs) *</label>
            <input class="form-control" id="f-peso" type="number" step="0.01" min="0" placeholder="0.00" value="${p.peso||''}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Unidades compradas *</label>
            <input class="form-control" id="f-uds" type="number" min="1" placeholder="1" value="${p.unidadesCompradas||1}">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0;margin-top:10px">
          <label>Código de importación / N° Orden Amazon</label>
          <input class="form-control" id="f-codImp" placeholder="Ej: 113-4567890-1234567" value="${p.codigoImportacion||''}">
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Tracking individual</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label>Estado de tracking</label>
            <select class="form-control" id="f-track">
              ${this.TRACKING.map(t=>`<option value="${t}" ${(p.trackingStatus||'pedido')===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Estado inventario</label>
            <select class="form-control" id="f-est">
              <option value="pendiente"  ${(!p.estado||p.estado==='pendiente')?'selected':''}>pendiente</option>
              <option value="disponible" ${p.estado==='disponible'?'selected':''}>disponible</option>
              <option value="agotado"    ${p.estado==='agotado'?'selected':''}>agotado</option>
            </select>
          </div>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Precio de venta</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label>% Ganancia</label>
            <input class="form-control" id="f-pct" type="number" min="0" placeholder="${pctDef}" value="${p.porcentajeGanancia!==undefined?p.porcentajeGanancia:pctDef}" oninput="Inventario._calcPrecio()">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Precio de venta</label>
            <input class="form-control" id="f-pventa" type="number" step="0.01" min="0" placeholder="0.00" value="${p.precioVenta||''}" oninput="Inventario._calcPct()">
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px">El costo courier se asignará cuando la importación sea recibida. El precio de venta se recalculará automáticamente.</div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Inventario.save('${id||''}')">💾 Guardar</button>
      </div>`, true);
  },

  _previewFoto(inp) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 500;
        let [w, h] = [img.width, img.height];
        if (w > max || h > max) { if (w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;} }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        window._fotoActual = canvas.toDataURL('image/jpeg', 0.78);
        document.getElementById('foto-wrap').innerHTML = `<img src="${window._fotoActual}" class="photo-preview">`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _calcPrecio() {
    const amz = parseFloat(document.getElementById('f-amz')?.value)    || 0;
    const cour= parseFloat(Storage.getProducto(document.querySelector('[id="f-nom"]')?.dataset?.id||'')?.costoCourier||0);
    const pct = parseFloat(document.getElementById('f-pct')?.value)    || 0;
    const inv = amz + cour;
    const ep  = document.getElementById('f-pventa');
    if (ep) ep.value = (inv * (1 + pct/100)).toFixed(2);
  },

  _calcPct() {
    const amz = parseFloat(document.getElementById('f-amz')?.value)    || 0;
    const pv  = parseFloat(document.getElementById('f-pventa')?.value) || 0;
    if (amz > 0) {
      const ep = document.getElementById('f-pct');
      if (ep) ep.value = ((pv - amz) / amz * 100).toFixed(1);
    }
  },

  save(id) {
    const nom = document.getElementById('f-nom')?.value.trim();
    if (!nom) { App.toast('El nombre es obligatorio', 'error'); return; }
    const amz  = parseFloat(document.getElementById('f-amz')?.value)    || 0;
    const pct  = parseFloat(document.getElementById('f-pct')?.value)    || 0;
    const existing = id ? Storage.getProducto(id) : null;

    Storage.saveProducto({
      id,
      nombre:            nom,
      descripcion:       document.getElementById('f-desc')?.value.trim()   || '',
      categoria:         document.getElementById('f-cat')?.value.trim()    || '',
      estado:            document.getElementById('f-est')?.value           || 'pendiente',
      trackingStatus:    document.getElementById('f-track')?.value         || 'pedido',
      costoAmazon:       amz,
      peso:              parseFloat(document.getElementById('f-peso')?.value)   || 0,
      unidadesCompradas: parseInt(document.getElementById('f-uds')?.value)      || 1,
      codigoImportacion: document.getElementById('f-codImp')?.value.trim() || '',
      costoCourier:      existing?.costoCourier   || 0,
      inversionTotal:    existing?.inversionTotal || amz,
      porcentajeGanancia:pct,
      precioVenta:       parseFloat(document.getElementById('f-pventa')?.value) || (amz * (1+pct/100)),
      stock:             existing?.stock          || 0,
      importacionId:     existing?.importacionId  || null,
      foto:              window._fotoActual       || null,
      fechaIngreso:      existing?.fechaIngreso   || Storage.today()
    });

    App.closeModal();
    App.toast(id ? 'Producto actualizado' : 'Producto registrado', 'success');
    this.render();
  },

  del(id) {
    const p = Storage.getProducto(id);
    App.confirm(`¿Eliminar "${p?.nombre}"?`, () => {
      Storage.deleteProducto(id);
      App.toast('Producto eliminado', 'success');
      this.render();
    });
  },

  importarExcel(inp) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const cfg  = Storage.getConfig();
        let ok = 0, skip = 0;
        rows.forEach(r => {
          const nom = String(r.nombre || r.Nombre || '').trim();
          if (!nom) { skip++; return; }
          const amz    = parseFloat(r.costoAmazon    || r.CostoAmazon    || 0);
          const pct    = parseFloat(r.porcentajeGanancia || r.PorcentajeGanancia || cfg.porcentajeDefault || 40);
          const pventa = parseFloat(r.precioVenta    || r.PrecioVenta    || 0) || Math.round(amz * (1 + pct / 100) * 100) / 100;
          const track  = String(r.trackingStatus || r.TrackingStatus || 'pedido').trim().toLowerCase();
          const est    = String(r.estado || r.Estado || 'pendiente').trim().toLowerCase();
          Storage.saveProducto({
            nombre:            nom,
            descripcion:       String(r.descripcion       || r.Descripcion       || '').trim(),
            categoria:         String(r.categoria         || r.Categoria         || '').trim(),
            costoAmazon:       amz,
            peso:              parseFloat(r.peso          || r.Peso              || 0),
            unidadesCompradas: parseInt(r.unidadesCompradas || r.UnidadesCompradas || 1) || 1,
            codigoImportacion: String(r.codigoImportacion || r.CodigoImportacion || '').trim(),
            porcentajeGanancia:pct,
            precioVenta:       pventa,
            inversionTotal:    amz,
            costoCourier:      0,
            stock:             parseInt(r.stock || r.Stock || 0) || 0,
            trackingStatus:    this.TRACKING.includes(track) ? track : 'pedido',
            estado:            ['pendiente','disponible','agotado'].includes(est) ? est : 'pendiente'
          });
          ok++;
        });
        App.toast(`${ok} productos importados${skip ? ' · ' + skip + ' omitidos (sin nombre)' : ''}`, ok > 0 ? 'success' : 'warning');
        inp.value = '';
        this.render();
      } catch (err) {
        App.toast('Error al leer el archivo. Verifica el formato.', 'error');
        console.error(err);
        inp.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  },

  _plantillaProductos() {
    const encabezado = [['nombre','descripcion','categoria','costoAmazon','peso','unidadesCompradas','codigoImportacion','porcentajeGanancia','precioVenta','trackingStatus','estado']];
    const ejemplo    = [["Conjunto Carter's T4","Conjunto niña floral","Ropa niña",15.99,0.5,2,"113-4567890-001",40,"","pedido","pendiente"]];
    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...ejemplo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  }
};
