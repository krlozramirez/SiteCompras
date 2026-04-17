const Reportes = {
  render() {
    const ventas    = Storage.getVentas();
    const productos = Storage.getProductos();
    const abonos    = Storage.getAbonos();
    const imports   = Storage.getImportaciones();

    const totalVentas   = ventas.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalInversion= imports.reduce((s,p)=>s+(parseFloat(p.valorAmazon||0)+parseFloat(p.valorCourier||0)),0);
    const totalCobrado  = ventas.reduce((s,v)=>s+parseFloat(v.pagadoInicial||0),0)
                        + abonos.reduce((s,a)=>s+parseFloat(a.monto||0),0);
    const totalCartera  = ventas.reduce((s,v)=>s+Storage.getSaldoVenta(v.id),0);

    // Ganancia = precio venta - costo de los productos vendidos
    let ganancia = 0;
    ventas.forEach(v => {
      (v.items||[]).forEach(item => {
        const p = Storage.getProducto(item.productoId);
        const costo = p ? parseFloat(p.inversionTotal||0) : 0;
        ganancia += (parseFloat(item.precioUnitario||0) - costo) * (parseInt(item.cantidad)||1);
      });
    });

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📊 Reportes</h1>
          <p class="page-subtitle">Resumen general del negocio</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <select class="form-control" style="width:auto" id="rep-periodo" onchange="Reportes._refrescar()">
            <option value="todo">Todo el tiempo</option>
            <option value="mes">Este mes</option>
            <option value="3m">Últimos 3 meses</option>
          </select>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card" style="border-left:4px solid var(--primary)">
          <div class="stat-label">Total Ventas</div>
          <div class="stat-value" style="font-size:20px">${Storage.fmt(totalVentas)}</div>
          <div class="stat-sub">${ventas.length} transacciones</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--success)">
          <div class="stat-label">Ganancia Bruta</div>
          <div class="stat-value" style="font-size:20px;color:var(--success)">${Storage.fmt(ganancia)}</div>
          <div class="stat-sub">${totalVentas > 0 ? (ganancia/totalVentas*100).toFixed(1) : 0}% margen</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--warning)">
          <div class="stat-label">Inversión Importaciones</div>
          <div class="stat-value" style="font-size:20px;color:var(--warning)">${Storage.fmt(totalInversion)}</div>
          <div class="stat-sub">${imports.length} importaciones</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--danger)">
          <div class="stat-label">Cartera Pendiente</div>
          <div class="stat-value" style="font-size:20px;color:var(--danger)">${Storage.fmt(totalCartera)}</div>
          <div class="stat-sub">${Storage.fmt(totalCobrado)} cobrado</div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <div class="chart-title">Ventas por mes</div>
          <canvas id="chart-ventas-mes"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-title">Inversión vs Ventas</div>
          <canvas id="chart-inv-vs-venta"></canvas>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <div class="chart-title">Productos más vendidos</div>
          <canvas id="chart-top-prod"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-title">Clientes con más compras</div>
          <canvas id="chart-top-cli"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Estado del inventario por categoría</div></div>
        <div id="rep-inv-cat"></div>
      </div>`;

    this._buildCharts(ventas, productos, imports);
    this._buildInvCat(productos);
  },

  _buildCharts(ventas, productos, imports) {
    // 1. Ventas por mes
    const meses = {};
    ventas.forEach(v => {
      const m = (v.fecha || '').substr(0, 7);
      if (m) meses[m] = (meses[m] || 0) + parseFloat(v.total || 0);
    });
    const mesesKeys = Object.keys(meses).sort().slice(-12);
    const c1 = new Chart(document.getElementById('chart-ventas-mes'), {
      type: 'bar',
      data: {
        labels: mesesKeys.map(m => { const [y,mo]=m.split('-'); return `${mo}/${y.substr(2)}`; }),
        datasets: [{ label: 'Ventas', data: mesesKeys.map(k=>meses[k]), backgroundColor: '#6366f1', borderRadius: 6 }]
      },
      options: { responsive:true, plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true } } }
    });
    App.registerChart(c1);

    // 2. Inversión vs Ventas (donut)
    const totalVentas = ventas.reduce((s,v)=>s+parseFloat(v.total||0),0);
    const totalCobrado = ventas.reduce((s,v)=>s+parseFloat(v.pagadoInicial||0),0)
                       + Storage.getAbonos().reduce((s,a)=>s+parseFloat(a.monto||0),0);
    const totalCartera = totalVentas - totalCobrado;
    const totalInv = imports.reduce((s,p)=>s+(parseFloat(p.valorAmazon||0)+parseFloat(p.valorCourier||0)),0);
    const c2 = new Chart(document.getElementById('chart-inv-vs-venta'), {
      type: 'doughnut',
      data: {
        labels: ['Cobrado', 'Cartera', 'Inversión'],
        datasets: [{ data: [totalCobrado, totalCartera, totalInv],
          backgroundColor: ['#10b981','#ef4444','#f59e0b'], borderWidth: 0 }]
      },
      options: { responsive:true, plugins:{ legend:{ position:'bottom' } }, cutout:'60%' }
    });
    App.registerChart(c2);

    // 3. Top productos vendidos
    const prodVentas = {};
    ventas.forEach(v => (v.items||[]).forEach(i => {
      prodVentas[i.nombre] = (prodVentas[i.nombre]||0) + (i.cantidad||1);
    }));
    const topProds = Object.entries(prodVentas).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const c3 = new Chart(document.getElementById('chart-top-prod'), {
      type: 'bar',
      data: {
        labels: topProds.map(([n])=>n.length>18?n.substr(0,18)+'…':n),
        datasets: [{ label:'Unidades', data: topProds.map(([,v])=>v), backgroundColor:'#10b981', borderRadius:6 }]
      },
      options: { indexAxis:'y', responsive:true, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    App.registerChart(c3);

    // 4. Top clientes
    const cliVentas = {};
    ventas.forEach(v => {
      cliVentas[v.clienteNombre||'Sin nombre'] = (cliVentas[v.clienteNombre||'Sin nombre']||0) + parseFloat(v.total||0);
    });
    const topCli = Object.entries(cliVentas).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const c4 = new Chart(document.getElementById('chart-top-cli'), {
      type: 'bar',
      data: {
        labels: topCli.map(([n])=>n.length>16?n.substr(0,16)+'…':n),
        datasets: [{ label:'Compras', data: topCli.map(([,v])=>v), backgroundColor:'#6366f1', borderRadius:6 }]
      },
      options: { indexAxis:'y', responsive:true, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    App.registerChart(c4);
  },

  _buildInvCat(productos) {
    const cats = {};
    productos.forEach(p => {
      const c = p.categoria || 'Sin categoría';
      if (!cats[c]) cats[c] = { total:0, disponibles:0, inversionStock:0 };
      cats[c].total++;
      if (p.estado === 'disponible') cats[c].disponibles++;
      cats[c].inversionStock += (parseFloat(p.inversionTotal)||0) * (parseInt(p.stock)||0);
    });

    const el = document.getElementById('rep-inv-cat');
    if (!el) return;
    if (!Object.keys(cats).length) { el.innerHTML = `<p style="color:var(--text-secondary);font-size:13px">Sin datos</p>`; return; }

    el.innerHTML = `<div class="table-wrapper"><table>
      <thead><tr><th>Categoría</th><th>Productos</th><th>Disponibles</th><th>Inversión en Stock</th></tr></thead>
      <tbody>
        ${Object.entries(cats).sort((a,b)=>b[1].total-a[1].total).map(([cat,d])=>`
          <tr>
            <td style="font-weight:600">${cat}</td>
            <td>${d.total}</td>
            <td><span style="color:var(--success);font-weight:700">${d.disponibles}</span></td>
            <td>${Storage.fmt(d.inversionStock)}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;
  },

  _refrescar() { this.render(); }
};
