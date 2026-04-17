const Catalogo = {
  _seleccionados: new Set(),

  render() {
    const productos = Storage.getProductos().filter(p => p.estado !== 'agotado');
    const cfg = Storage.getConfig();
    this._seleccionados = new Set();

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📄 Catálogo PDF</h1>
          <p class="page-subtitle">Selecciona los productos y genera el catálogo</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="Catalogo.selTodos(true)">Seleccionar todos</button>
          <button class="btn btn-ghost" onclick="Catalogo.selTodos(false)">Deseleccionar</button>
          <button class="btn btn-primary" onclick="Catalogo.generarPDF()">📄 Generar PDF</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Opciones del catálogo</div></div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Título del catálogo</label>
            <input class="form-control" id="cat-titulo" value="${cfg.nombreNegocio || 'Catálogo'} — ${new Date().toLocaleDateString('es')}">
          </div>
          <div class="form-group">
            <label>Subtítulo / Temporada</label>
            <input class="form-control" id="cat-subtitulo" placeholder="Ej: Colección Primavera 2025">
          </div>
          <div class="form-group">
            <label>Mostrar precios</label>
            <select class="form-control" id="cat-precios">
              <option value="si">Sí, mostrar precios</option>
              <option value="no">No mostrar precios</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="card-title">Productos disponibles</div>
          <span id="cat-count" style="font-size:13px;color:var(--text-secondary)">0 seleccionados</span>
        </div>
        <div class="toolbar">
          <input type="text" class="search-input" id="cat-q" placeholder="Buscar..." oninput="Catalogo.filter()">
          <select class="form-control" style="width:auto" id="cat-cat" onchange="Catalogo.filter()">
            <option value="">Todas las categorías</option>
            ${[...new Set(productos.map(p=>p.categoria).filter(Boolean))].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="product-grid" id="cat-grid">
          ${this._renderGrid(productos)}
        </div>
      </div>`;
  },

  _renderGrid(productos) {
    if (!productos.length) return `<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3></div>`;
    return productos.map(p => `
      <div class="product-check-card ${this._seleccionados.has(p.id)?'selected':''}" onclick="Catalogo.toggle('${p.id}',this)" id="pcc-${p.id}">
        <div class="check-badge">✓</div>
        ${p.foto
          ? `<img src="${p.foto}" alt="${p.nombre}">`
          : `<div class="no-img">📦</div>`}
        <div style="font-size:12px;font-weight:700;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nombre}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${p.categoria||''}</div>
        <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:4px">${Storage.fmt(p.precioVenta)}</div>
      </div>`).join('');
  },

  toggle(id, el) {
    if (this._seleccionados.has(id)) { this._seleccionados.delete(id); el.classList.remove('selected'); }
    else { this._seleccionados.add(id); el.classList.add('selected'); }
    const cnt = document.getElementById('cat-count');
    if (cnt) cnt.textContent = `${this._seleccionados.size} seleccionados`;
  },

  selTodos(sel) {
    const productos = Storage.getProductos().filter(p => p.estado !== 'agotado');
    this._seleccionados = sel ? new Set(productos.map(p=>p.id)) : new Set();
    document.querySelectorAll('.product-check-card').forEach(el => {
      const id = el.id.replace('pcc-','');
      el.classList.toggle('selected', this._seleccionados.has(id));
    });
    const cnt = document.getElementById('cat-count');
    if (cnt) cnt.textContent = `${this._seleccionados.size} seleccionados`;
  },

  filter() {
    const q   = (document.getElementById('cat-q')?.value   || '').toLowerCase();
    const cat = document.getElementById('cat-cat')?.value || '';
    let p = Storage.getProductos().filter(x => x.estado !== 'agotado');
    if (q)   p = p.filter(x => `${x.nombre}${x.categoria}`.toLowerCase().includes(q));
    if (cat) p = p.filter(x => x.categoria === cat);
    const grid = document.getElementById('cat-grid');
    if (grid) grid.innerHTML = this._renderGrid(p);
  },

  generarPDF() {
    if (!this._seleccionados.size) { App.toast('Selecciona al menos un producto', 'warning'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cfg     = Storage.getConfig();
    const titulo  = document.getElementById('cat-titulo')?.value   || cfg.nombreNegocio;
    const subtit  = document.getElementById('cat-subtitulo')?.value|| '';
    const mostrarPrecios = document.getElementById('cat-precios')?.value !== 'no';
    const productos = Storage.getProductos().filter(p => this._seleccionados.has(p.id));

    const W = 210, H = 297;
    const margin  = 14;
    const cols    = 3;
    const colW    = (W - margin * 2) / cols;
    const imgH    = 42;
    const cardH   = imgH + (mostrarPrecios ? 22 : 16);
    const gap     = 6;
    const headerH = cfg.logo ? 36 : 28;

    // Color del catálogo (configurable)
    const hex  = cfg.catalogColor || '#ec4899';
    const cr   = parseInt(hex.slice(1, 3), 16);
    const cg   = parseInt(hex.slice(3, 5), 16);
    const cb   = parseInt(hex.slice(5, 7), 16);

    // ── Header ──
    doc.setFillColor(cr, cg, cb);
    doc.rect(0, 0, W, headerH, 'F');

    // Logo (si existe) — lado izquierdo del header
    const logoSize = 24;
    const logoY    = (headerH - logoSize) / 2;
    if (cfg.logo) {
      try {
        const fmt = cfg.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(cfg.logo, fmt, margin, logoY, logoSize, logoSize, undefined, 'FAST');
      } catch {}
    }

    // Título — centrado o desplazado si hay logo
    const textX     = cfg.logo ? margin + logoSize + 6 : W / 2;
    const textAlign = cfg.logo ? 'left' : 'center';
    const titleY    = subtit ? headerH / 2 - 1 : headerH / 2 + 4;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(cfg.logo ? 15 : 18);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, textX, titleY, { align: textAlign });
    if (subtit) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(subtit, textX, titleY + 8, { align: textAlign });
    }

    let x = margin, y = headerH + 6;
    let col = 0;

    productos.forEach((p, idx) => {
      // Nueva página si no cabe
      if (y + cardH > H - margin) {
        doc.addPage();
        y = margin;
        x = margin;
        col = 0;
      }

      // Fondo tarjeta
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, colW - gap, cardH, 3, 3, 'F');

      // Imagen
      if (p.foto) {
        try { doc.addImage(p.foto, 'JPEG', x + 2, y + 2, colW - gap - 4, imgH - 4, undefined, 'FAST'); }
        catch {}
      } else {
        doc.setFillColor(226, 232, 240);
        doc.rect(x + 2, y + 2, colW - gap - 4, imgH - 4, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text('Sin foto', x + colW / 2 - gap / 2, y + imgH / 2 + 2, { align: 'center' });
      }

      // Nombre
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(p.nombre, colW - gap - 4);
      doc.text(lines.slice(0, 2), x + 2, y + imgH + 5);

      // Precio
      if (mostrarPrecios) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(cr, cg, cb);
        doc.text(Storage.fmt(p.precioVenta), x + 2, y + imgH + 14);
      }

      col++;
      if (col >= cols) { col = 0; x = margin; y += cardH + gap; }
      else { x += colW; }
    });

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(`${cfg.nombreNegocio || ''} — Página ${i} de ${pages}`, W / 2, H - 6, { align: 'center' });
    }

    const fname = `catalogo_${(titulo).replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${Storage.today()}.pdf`;
    doc.save(fname);
    App.toast('PDF generado correctamente', 'success');
  }
};
