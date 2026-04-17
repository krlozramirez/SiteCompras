const Clientes = {
  render() {
    const lista = Storage.getClientes().sort((a, b) => a.nombre.localeCompare(b.nombre));

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">👥 Clientes</h1>
          <p class="page-subtitle">${lista.length} clientes registrados</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="file" id="cli-import-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="Clientes.importarExcel(this)">
          <button class="btn btn-outline" onclick="Clientes._plantillaClientes()">⬇️ Plantilla</button>
          <button class="btn btn-outline" onclick="document.getElementById('cli-import-file').click()">⬆️ Importar Excel</button>
          <button class="btn btn-primary" onclick="Clientes.openForm()">+ Nuevo Cliente</button>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input type="text" class="search-input" id="cli-q" placeholder="Buscar nombre, teléfono, red social..." oninput="Clientes.filter()">
        </div>
        <div id="cli-body">${this._table(lista)}</div>
      </div>`;
  },

  _table(lista) {
    if (!lista.length) return `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Sin clientes</h3>
        <p>Agrega tu primer cliente</p>
      </div>`;

    return `<div class="table-wrapper"><table>
      <thead><tr>
        <th>Cliente</th><th>Teléfono</th><th>Red Social</th>
        <th>Compras</th><th>Saldo Pendiente</th><th>Registro</th><th></th>
      </tr></thead>
      <tbody>
        ${lista.map(c => {
          const saldo = Storage.getSaldoCliente(c.id);
          const total = Storage.getTotalVentasCliente(c.id);
          return `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar">${(c.nombre[0]||'?').toUpperCase()}</div>
                  <div>
                    <div style="font-weight:600">${c.nombre}</div>
                    ${c.notas ? `<div style="font-size:11px;color:var(--text-secondary)">${c.notas}</div>` : ''}
                  </div>
                </div>
              </td>
              <td>${c.telefono || '-'}</td>
              <td>${c.redSocial ? `<span style="color:var(--primary)">@${c.redSocial}</span>` : '-'}</td>
              <td>${Storage.fmt(total)}</td>
              <td>
                ${saldo > 0
                  ? `<span style="color:var(--danger);font-weight:700">${Storage.fmt(saldo)}</span>`
                  : `<span class="badge badge-success">Al día</span>`}
              </td>
              <td>${Storage.fmtDate(c.fechaRegistro)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="Clientes.verDetalle('${c.id}')">👁️</button>
                  <button class="btn btn-ghost btn-sm" title="Imprimir etiqueta de envío" onclick="Clientes.imprimirEtiqueta('${c.id}')">🏷️</button>
                  <button class="btn btn-ghost btn-sm" onclick="Clientes.openForm('${c.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm" onclick="Clientes.del('${c.id}')">🗑️</button>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  filter() {
    const q = (document.getElementById('cli-q')?.value || '').toLowerCase();
    let lista = Storage.getClientes().sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (q) lista = lista.filter(c => `${c.nombre}${c.telefono}${c.redSocial}${c.notas}`.toLowerCase().includes(q));
    document.getElementById('cli-body').innerHTML = this._table(lista);
  },

  openForm(id) {
    const c = id ? (Storage.getCliente(id) || {}) : {};

    App.openModal(id ? 'Editar Cliente' : 'Nuevo Cliente', `
      <div class="form-row">
        <div class="form-group">
          <label>Nombre *</label>
          <input class="form-control" id="f-nom" placeholder="Nombre completo" value="${c.nombre||''}">
        </div>
        <div class="form-group">
          <label>Cédula / RUC</label>
          <input class="form-control" id="f-ced" placeholder="Ej: 1712345678" value="${c.cedula||''}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Teléfono</label>
          <input class="form-control" id="f-tel" placeholder="Ej: 0991234567" value="${c.telefono||''}">
        </div>
        <div class="form-group">
          <label>Correo electrónico</label>
          <input class="form-control" id="f-correo" type="email" placeholder="ejemplo@correo.com" value="${c.correo||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Dirección de envío</label>
        <input class="form-control" id="f-dir" placeholder="Calle, número, sector..." value="${c.direccion||''}">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Instagram / Red Social</label>
          <input class="form-control" id="f-red" placeholder="usuario (sin @)" value="${c.redSocial||''}">
        </div>
        <div class="form-group">
          <label>Ciudad</label>
          <input class="form-control" id="f-ciudad" placeholder="Ej: Quito" value="${c.ciudad||''}">
        </div>
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="f-notas" rows="2" placeholder="Observaciones, preferencias...">${c.notas||''}</textarea>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Clientes.save('${id||''}')">💾 Guardar</button>
      </div>`);
  },

  save(id) {
    const nom = document.getElementById('f-nom')?.value.trim();
    if (!nom) { App.toast('El nombre es obligatorio', 'error'); return; }

    Storage.saveCliente({
      id:           id || null,
      nombre:       nom,
      cedula:       document.getElementById('f-ced')?.value.trim()    || '',
      telefono:     document.getElementById('f-tel')?.value.trim()    || '',
      correo:       document.getElementById('f-correo')?.value.trim() || '',
      direccion:    document.getElementById('f-dir')?.value.trim()    || '',
      redSocial:    document.getElementById('f-red')?.value.trim()    || '',
      ciudad:       document.getElementById('f-ciudad')?.value.trim() || '',
      notas:        document.getElementById('f-notas')?.value.trim()  || '',
      fechaRegistro: id ? Storage.getCliente(id)?.fechaRegistro : undefined
    });

    App.closeModal();
    App.toast(id ? 'Cliente actualizado' : 'Cliente registrado', 'success');
    this.render();
  },

  del(id) {
    const c = Storage.getCliente(id);
    const saldo = Storage.getSaldoCliente(id);
    const msg = saldo > 0
      ? `"${c?.nombre}" tiene saldo pendiente de ${Storage.fmt(saldo)}. ¿Eliminar de todas formas?`
      : `¿Eliminar a "${c?.nombre}"?`;
    App.confirm(msg, () => {
      Storage.deleteCliente(id);
      App.toast('Cliente eliminado', 'success');
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
        let ok = 0, skip = 0;
        rows.forEach(r => {
          const nom = String(r.nombre || r.Nombre || '').trim();
          if (!nom) { skip++; return; }
          Storage.saveCliente({
            nombre:    nom,
            telefono:  String(r.telefono   || r.Telefono   || '').trim(),
            redSocial: String(r.redSocial  || r.RedSocial  || r.instagram || r.Instagram || '').trim(),
            ciudad:    String(r.ciudad     || r.Ciudad     || '').trim(),
            notas:     String(r.notas      || r.Notas      || '').trim()
          });
          ok++;
        });
        App.toast(`${ok} clientes importados${skip ? ' · ' + skip + ' omitidos (sin nombre)' : ''}`, ok > 0 ? 'success' : 'warning');
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

  _plantillaClientes() {
    const encabezado = [['nombre','telefono','redSocial','ciudad','notas']];
    const ejemplo    = [['María García','0991234567','mariagarcia','Quito','Cliente frecuente']];
    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...ejemplo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'plantilla_clientes.xlsx');
  },

  imprimirEtiqueta(id) {
    const c   = Storage.getCliente(id);
    if (!c) return;
    const cfg     = Storage.getConfig();
    const color   = cfg.catalogColor || '#1e293b';
    const logoHTML = cfg.logo
      ? `<img src="${cfg.logo}" style="height:32px;margin-bottom:4px;display:block;border-radius:4px">`
      : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiqueta — ${c.nombre}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;background:#fff}
  .toolbar{padding:12px 16px;background:#f1f5f9;display:flex;gap:10px;align-items:center;border-bottom:1px solid #e2e8f0}
  .toolbar button{padding:8px 20px;font-size:14px;cursor:pointer;border:1px solid #94a3b8;border-radius:6px;background:#fff;font-weight:600}
  .toolbar .btn-print{background:#6366f1;color:#fff;border-color:#6366f1}
  .page{padding:24px}
  .etiqueta{width:10cm;border:2px solid ${color};border-radius:6px;overflow:hidden;font-family:Arial,sans-serif}
  .remitente{background:${color};color:#fff;padding:10px 14px;font-size:9.5pt}
  .remitente .biz{font-weight:700;font-size:10.5pt}
  .separador{border:none;border-top:1.5px dashed #94a3b8;margin:0}
  .destinatario{padding:14px}
  .para-label{font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .dest-nombre{font-size:14pt;font-weight:900;color:#0f172a;margin-bottom:10px;line-height:1.2}
  .campo{display:flex;gap:6px;margin:4px 0;font-size:10pt;align-items:flex-start}
  .campo .lbl{color:#64748b;font-size:8.5pt;min-width:60px;padding-top:1px}
  .campo .val{color:#1e293b;font-weight:500}
  @media print{
    .toolbar{display:none}
    .page{padding:4mm}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
  <button onclick="window.close()">✕ Cerrar</button>
  <span style="font-size:12px;color:#64748b">Etiqueta de envío · ${c.nombre}</span>
</div>
<div class="page">
  <div class="etiqueta">
    <div class="remitente">
      ${logoHTML}
      <div class="biz">DE: ${cfg.nombreNegocio || 'ImportApp'}</div>
      ${cfg.notas ? `<div style="font-size:8pt;opacity:.75;margin-top:2px">${cfg.notas}</div>` : ''}
    </div>
    <hr class="separador">
    <div class="destinatario">
      <div class="para-label">Destinatario</div>
      <div class="dest-nombre">${c.nombre}</div>
      ${c.cedula    ? `<div class="campo"><span class="lbl">CI/RUC:</span><span class="val">${c.cedula}</span></div>` : ''}
      ${c.direccion ? `<div class="campo"><span class="lbl">Dirección:</span><span class="val">${c.direccion}</span></div>` : ''}
      ${c.ciudad    ? `<div class="campo"><span class="lbl">Ciudad:</span><span class="val">${c.ciudad}</span></div>` : ''}
      ${c.telefono  ? `<div class="campo"><span class="lbl">Tel:</span><span class="val">${c.telefono}</span></div>` : ''}
      ${c.correo    ? `<div class="campo"><span class="lbl">Email:</span><span class="val">${c.correo}</span></div>` : ''}
    </div>
  </div>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=520,height=480,resizable=yes');
    if (!win) { App.toast('Activa las ventanas emergentes para imprimir etiquetas', 'warning'); return; }
    win.document.write(html);
    win.document.close();
  },

  verDetalle(id) {
    const c = Storage.getCliente(id);
    if (!c) return;
    const ventas  = Storage.getVentas().filter(v => v.clienteId === id);
    const saldo   = Storage.getSaldoCliente(id);
    const totalVentas = Storage.getTotalVentasCliente(id);
    const abonos  = Storage.getAbonosByCliente(id);

    App.openModal(`👤 ${c.nombre}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div class="stat-card" style="border:1px solid var(--border)">
          <div class="stat-label">Total Compras</div>
          <div class="stat-value" style="font-size:20px">${Storage.fmt(totalVentas)}</div>
        </div>
        <div class="stat-card" style="border:1px solid var(--border);${saldo>0?'border-color:var(--danger)':''}">
          <div class="stat-label">Saldo Pendiente</div>
          <div class="stat-value" style="font-size:20px;color:${saldo>0?'var(--danger)':'var(--success)'}">${Storage.fmt(saldo)}</div>
        </div>
      </div>

      <div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">Información</div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;line-height:1.9">
        ${c.cedula    ? `🪪 CI/RUC: <strong>${c.cedula}</strong><br>` : ''}
        ${c.telefono  ? `📞 ${c.telefono}<br>` : ''}
        ${c.correo    ? `📧 ${c.correo}<br>` : ''}
        ${c.direccion ? `🏠 ${c.direccion}<br>` : ''}
        ${c.ciudad    ? `📍 ${c.ciudad}<br>` : ''}
        ${c.redSocial ? `📱 @${c.redSocial}<br>` : ''}
        ${c.notas     ? `📝 ${c.notas}` : ''}
      </div>

      <div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">Historial de Ventas (${ventas.length})</div>
      ${ventas.length
        ? `<div style="max-height:200px;overflow-y:auto">
            ${ventas.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(v => {
              const sv = Storage.getSaldoVenta(v.id);
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <div>
                  <div style="font-weight:600">${Storage.fmtDate(v.fecha)}</div>
                  <div style="color:var(--text-secondary)">${(v.items||[]).length} producto(s)</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700">${Storage.fmt(v.total)}</div>
                  ${sv > 0 ? `<div style="color:var(--danger);font-size:11px">Debe: ${Storage.fmt(sv)}</div>` : `<div class="badge badge-success" style="font-size:10px">Pagado</div>`}
                </div>
              </div>`;
            }).join('')}
          </div>`
        : `<p style="color:var(--text-secondary);font-size:13px">Sin ventas registradas</p>`}

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
        <button class="btn btn-outline" onclick="App.closeModal();Clientes.imprimirEtiqueta('${id}')">🏷️ Etiqueta</button>
        <button class="btn btn-primary" onclick="App.closeModal();Ventas.openCarrito('${id}')">🛒 Nuevo Pedido Cliente</button>
      </div>`, true);
  }
};
