const Cartera = {
  render() {
    const clientes = Storage.getClientes();
    const conSaldo  = clientes.filter(c => Storage.getSaldoCliente(c.id) > 0)
                              .sort((a,b) => Storage.getSaldoCliente(b.id) - Storage.getSaldoCliente(a.id));
    const totalCartera = conSaldo.reduce((s, c) => s + Storage.getSaldoCliente(c.id), 0);
    const totalVentas  = Storage.getVentas().reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalCobrado = totalVentas - totalCartera;

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">💰 Cartera</h1>
          <p class="page-subtitle">${conSaldo.length} clientes con saldo pendiente</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-outline btn-sm" onclick="Cartera.exportar('mora')">⬇️ En mora</button>
          <button class="btn btn-outline btn-sm" onclick="Cartera.exportar('todo')">⬇️ Todo</button>
          <button class="btn btn-outline btn-sm" onclick="Cartera._exportFecha()">⬇️ Por fechas...</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Cartera Total</div>
          <div class="stat-value" style="font-size:18px;color:var(--danger)">${Storage.fmt(totalCartera)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cobrado</div>
          <div class="stat-value" style="font-size:18px;color:var(--success)">${Storage.fmt(totalCobrado)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Clientes en mora</div>
          <div class="stat-value" style="color:var(--danger)">${conSaldo.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Clientes al día</div>
          <div class="stat-value" style="color:var(--success)">${clientes.length - conSaldo.length}</div>
        </div>
      </div>

      ${conSaldo.length === 0
        ? `<div class="card"><div class="empty-state"><div class="empty-icon">🎉</div><h3>Todo al día</h3><p>No hay saldos pendientes</p></div></div>`
        : `<div class="card">
            <div class="card-header">
              <div class="card-title">Clientes con saldo pendiente</div>
            </div>
            <div class="table-wrapper"><table>
              <thead><tr>
                <th>Cliente</th><th>Contacto</th><th>Total Compras</th><th>Saldo Pendiente</th><th>% Pagado</th><th></th>
              </tr></thead>
              <tbody>
                ${conSaldo.map(c => {
                  const saldo = Storage.getSaldoCliente(c.id);
                  const total = Storage.getTotalVentasCliente(c.id);
                  const pct   = total > 0 ? Math.round((total - saldo) / total * 100) : 0;
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px">
                          <div class="avatar">${(c.nombre[0]||'?').toUpperCase()}</div>
                          <div style="font-weight:600">${c.nombre}</div>
                        </div>
                      </td>
                      <td style="font-size:13px">
                        ${c.telefono||''} ${c.redSocial?`<span style="color:var(--primary)">@${c.redSocial}</span>`:''}
                      </td>
                      <td>${Storage.fmt(total)}</td>
                      <td><strong style="color:var(--danger)">${Storage.fmt(saldo)}</strong></td>
                      <td style="min-width:120px">
                        <div style="font-size:12px;margin-bottom:3px">${pct}% pagado</div>
                        <div class="deuda-bar">
                          <div class="deuda-fill" style="width:${pct}%"></div>
                        </div>
                      </td>
                      <td>
                        <button class="btn btn-success btn-sm" onclick="Cartera.openAbonoCliente('${c.id}')">💵 Abonar</button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table></div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Últimos abonos registrados</div>
            </div>
            ${this._renderAbonos()}
          </div>`}
    `;
  },

  _renderAbonos() {
    const abonos = Storage.getAbonos()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 20);

    if (!abonos.length) return `<p style="color:var(--text-secondary);font-size:13px">Sin abonos registrados</p>`;

    return `<div class="table-wrapper"><table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Monto</th><th>Notas</th></tr></thead>
      <tbody>
        ${abonos.map(a => {
          const c = Storage.getCliente(a.clienteId);
          return `
            <tr>
              <td>${Storage.fmtDate(a.fecha)}</td>
              <td>${c?.nombre || '-'}</td>
              <td><strong style="color:var(--success)">${Storage.fmt(a.monto)}</strong></td>
              <td style="color:var(--text-secondary)">${a.notas || '-'}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  },

  exportar(filtro, desde, hasta) {
    const clientes = Storage.getClientes();
    let rows = [];

    if (filtro === 'fecha') {
      const ventasRango = Storage.getVentas().filter(v => v.fecha >= desde && v.fecha <= hasta);
      const saldosCli = {}, totalCli = {}, ventasCli = {};
      ventasRango.forEach(v => {
        const s = Storage.getSaldoVenta(v.id);
        if (!saldosCli[v.clienteId]) { saldosCli[v.clienteId] = 0; totalCli[v.clienteId] = 0; ventasCli[v.clienteId] = []; }
        saldosCli[v.clienteId] += s;
        totalCli[v.clienteId]  += parseFloat(v.total || 0);
        ventasCli[v.clienteId].push(Storage.fmtDate(v.fecha));
      });
      rows = Object.keys(saldosCli)
        .filter(cid => saldosCli[cid] > 0)
        .map(cid => {
          const c = Storage.getCliente(cid);
          return {
            'Cliente':              c?.nombre || cid,
            'Teléfono':             c?.telefono || '',
            'Red Social':           c?.redSocial ? '@' + c.redSocial : '',
            'Ciudad':               c?.ciudad || '',
            'Total Ventas (rango)': totalCli[cid],
            'Saldo Pendiente':      saldosCli[cid],
            'Fechas de ventas':     ventasCli[cid].join(', ')
          };
        });
    } else {
      rows = clientes
        .filter(c => filtro === 'mora' ? Storage.getSaldoCliente(c.id) > 0 : true)
        .map(c => ({
          'Cliente':         c.nombre,
          'Teléfono':        c.telefono    || '',
          'Red Social':      c.redSocial   ? '@' + c.redSocial : '',
          'Ciudad':          c.ciudad      || '',
          'Total Compras':   Storage.getTotalVentasCliente(c.id),
          'Saldo Pendiente': Storage.getSaldoCliente(c.id)
        }));
    }

    if (!rows.length) { App.toast('Sin datos para exportar', 'warning'); return; }

    const ws = XLSX.utils.json_to_sheet(rows);
    // Ajustar ancho de columnas automáticamente
    const cols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }));
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
    const nombre = filtro === 'fecha'
      ? `cartera_${desde}_al_${hasta}`
      : `cartera_${filtro}_${Storage.today()}`;
    XLSX.writeFile(wb, `${nombre}.xlsx`);
    App.toast(`${rows.length} registros exportados`, 'success');
  },

  _exportFecha() {
    const hoy      = Storage.today();
    const inicioMes = hoy.substr(0, 7) + '-01';
    App.openModal('📅 Exportar cartera por rango de fechas', `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.6">
        Se exportarán los clientes con saldo pendiente de ventas realizadas en el período seleccionado.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label>Desde</label>
          <input class="form-control" id="exp-desde" type="date" value="${inicioMes}">
        </div>
        <div class="form-group">
          <label>Hasta</label>
          <input class="form-control" id="exp-hasta" type="date" value="${hoy}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="
          const d=document.getElementById('exp-desde').value;
          const h=document.getElementById('exp-hasta').value;
          if(!d||!h){App.toast('Selecciona ambas fechas','warning');return;}
          App.closeModal();
          Cartera.exportar('fecha',d,h);
        ">⬇️ Exportar Excel</button>
      </div>`);
  },

  openAbonoCliente(clienteId) {
    const c = Storage.getCliente(clienteId);
    const ventas = Storage.getVentas()
      .filter(v => v.clienteId === clienteId && Storage.getSaldoVenta(v.id) > 0)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const saldoTotal = Storage.getSaldoCliente(clienteId);

    App.openModal(`💵 Abono — ${c?.nombre}`, `
      <div style="background:#fff3f3;border:1px solid var(--danger);border-radius:8px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;color:var(--danger)">Saldo total pendiente</span>
        <span style="font-size:20px;font-weight:700;color:var(--danger)">${Storage.fmt(saldoTotal)}</span>
      </div>

      <div class="form-group">
        <label>Aplicar abono a la venta</label>
        <select class="form-control" id="ab-venta">
          ${ventas.map(v => `<option value="${v.id}">
            ${Storage.fmtDate(v.fecha)} — Saldo: ${Storage.fmt(Storage.getSaldoVenta(v.id))}
          </option>`).join('')}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Monto *</label>
          <input class="form-control" id="ab-monto" type="number" step="0.01" min="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input class="form-control" id="ab-fecha" type="date" value="${Storage.today()}">
        </div>
      </div>

      <div class="form-group">
        <label>Forma de pago / Notas</label>
        <input class="form-control" id="ab-notas" placeholder="Efectivo, transferencia, Nequi...">
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="Cartera.saveAbono('${clienteId}')">💾 Registrar Abono</button>
      </div>`);
  },

  saveAbono(clienteId) {
    const ventaId = document.getElementById('ab-venta')?.value;
    const monto   = parseFloat(document.getElementById('ab-monto')?.value);
    if (!ventaId) { App.toast('Selecciona la venta', 'error'); return; }
    if (!monto || monto <= 0) { App.toast('Ingresa un monto válido', 'error'); return; }
    const saldo = Storage.getSaldoVenta(ventaId);
    if (monto > saldo + 0.01) { App.toast(`El abono supera el saldo (${Storage.fmt(saldo)})`, 'warning'); return; }

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
  }
};
