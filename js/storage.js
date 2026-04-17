const Storage = {
  K: {
    PRODUCTOS:    'imp_productos',
    IMPORTACIONES:'imp_importaciones',
    CLIENTES:     'imp_clientes',
    VENTAS:       'imp_ventas',
    ABONOS:       'imp_abonos',
    CONFIG:       'imp_config'
  },

  _cache:     {},   // espejo en memoria de los datos activos
  _dirHandle: null, // FileSystemDirectoryHandle (si el usuario eligió carpeta)
  _dbProm:    null, // promesa de IndexedDB reutilizable

  // ── Inicialización (llamar al arrancar la app) ─────────────────────────────
  async initStorage() {
    const handle = await this._loadHandle();
    if (!handle) return false;
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return false;
      this._dirHandle = handle;
      await this._loadAllFromFiles();
      return true;
    } catch { return false; }
  },

  // Abre el selector de carpeta; migra datos existentes a los archivos
  async selectFolder() {
    if (!('showDirectoryPicker' in window)) {
      App.toast('Tu navegador no soporta esta función. Usa Chrome o Edge.', 'error');
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
      this._dirHandle = handle;
      await this._saveHandle(handle);
      await this._writeAllToFiles();
      return handle.name;
    } catch (e) {
      if (e.name !== 'AbortError') App.toast('No se pudo acceder a la carpeta', 'error');
      return null;
    }
  },

  getFolderName() { return this._dirHandle?.name || null; },

  async disconnectFolder() {
    this._dirHandle = null;
    await this._deleteHandle();
  },

  async syncAll() {
    if (!this._dirHandle) return { ok: false, reason: 'no-folder' };
    try {
      await this._writeAllToFiles();
      return { ok: true };
    } catch(e) { return { ok: false, reason: e.message }; }
  },

  // ── IndexedDB — persiste el FileSystemDirectoryHandle entre sesiones ───────
  _openDB() {
    if (this._dbProm) return this._dbProm;
    this._dbProm = new Promise((res, rej) => {
      const r = indexedDB.open('importapp_v1', 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore('h');
      r.onsuccess = e => res(e.target.result);
      r.onerror   = () => rej(r.error);
    });
    return this._dbProm;
  },
  async _saveHandle(h) {
    const db = await this._openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('h', 'readwrite');
      tx.objectStore('h').put(h, 'dir');
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  },
  async _loadHandle() {
    try {
      const db = await this._openDB();
      return new Promise(res => {
        const tx  = db.transaction('h', 'readonly');
        const req = tx.objectStore('h').get('dir');
        req.onsuccess = () => res(req.result || null);
        req.onerror   = () => res(null);
      });
    } catch { return null; }
  },
  async _deleteHandle() {
    try {
      const db = await this._openDB();
      const tx  = db.transaction('h', 'readwrite');
      tx.objectStore('h').delete('dir');
    } catch {}
  },

  // ── File I/O ───────────────────────────────────────────────────────────────
  async _writeFile(key, val) {
    if (!this._dirHandle) return;
    try {
      const fh = await this._dirHandle.getFileHandle(`${key}.json`, { create: true });
      const wr = await fh.createWritable();
      await wr.write(JSON.stringify(val, null, 2));
      await wr.close();
    } catch (e) { console.warn('[ImportApp] Error escribiendo', key, e); }
  },

  async _loadAllFromFiles() {
    for (const key of Object.values(this.K)) {
      try {
        if (key === this.K.PRODUCTOS) {
          // Productos: leer JSON con refs + hidratar imágenes desde archivos
          const list = await this._readProductosFromFile();
          if (list !== null) {
            this._cache[key] = list;
            localStorage.setItem(key, JSON.stringify(list));
          }
        } else {
          const fh   = await this._dirHandle.getFileHandle(`${key}.json`);
          const file = await fh.getFile();
          const data = JSON.parse(await file.text());
          this._cache[key] = data;
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch { /* archivo no existe aún, se creará al primer _set */ }
    }
    // Cargar configuración de GitHub desde archivo (permite compartir entre dispositivos)
    try {
      const fh   = await this._dirHandle.getFileHandle('imp_github_cfg.json');
      const file = await fh.getFile();
      const data = JSON.parse(await file.text());
      if (data && data.owner) localStorage.setItem('imp_github_cfg', JSON.stringify(data));
    } catch {}
  },

  async _writeAllToFiles() {
    for (const key of Object.values(this.K)) {
      const val = this._cache[key] !== undefined
        ? this._cache[key]
        : (() => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } })();
      if (val === null || val === undefined) continue;
      if (key === this.K.PRODUCTOS) await this._writeProductosFile(val);
      else await this._writeFile(key, val);
    }
    // Guardar configuración de GitHub en archivo (para no reingresarla en otro dispositivo)
    try {
      const ghData = JSON.parse(localStorage.getItem('imp_github_cfg'));
      if (ghData && ghData.owner) await this._writeFile('imp_github_cfg', ghData);
    } catch {}
  },

  // ── Image file operations ──────────────────────────────────────────────────
  // Escribe la imagen de un producto como archivo img_[id].jpg en la carpeta
  async _writeImageFile(productoId, base64) {
    if (!this._dirHandle || !base64 || !base64.startsWith('data:image/')) return null;
    try {
      const [header, data] = base64.split(',');
      const mime     = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const ext      = mime.includes('png') ? 'png' : 'jpg';
      const filename = `img_${productoId}.${ext}`;
      const bytes    = atob(data);
      const arr      = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const fh = await this._dirHandle.getFileHandle(filename, { create: true });
      const wr = await fh.createWritable();
      await wr.write(arr);
      await wr.close();
      return filename;
    } catch(e) { console.warn('[ImportApp] Error escribiendo imagen', productoId, e); return null; }
  },

  // Lee un archivo de imagen de la carpeta y devuelve base64
  async _readImageFile(filename) {
    if (!this._dirHandle || !filename) return null;
    try {
      const fh   = await this._dirHandle.getFileHandle(filename);
      const file = await fh.getFile();
      return new Promise(res => {
        const rd = new FileReader();
        rd.onload  = e => res(e.target.result);
        rd.onerror = () => res(null);
        rd.readAsDataURL(file);
      });
    } catch { return null; }
  },

  // Borra los archivos de imagen de un producto (por id)
  async _deleteImageFile(productoId) {
    if (!this._dirHandle) return;
    for (const ext of ['jpg', 'png']) {
      try { await this._dirHandle.removeEntry(`img_${productoId}.${ext}`); } catch {}
    }
  },

  // Escribe los productos en disco: imágenes como archivos .jpg, JSON solo con refs
  async _writeProductosFile(list) {
    if (!this._dirHandle) return;
    const fileList = [];
    for (const p of list) {
      const cp = { ...p };
      if (cp.foto && cp.foto.startsWith('data:image/')) {
        const fname = await this._writeImageFile(p.id, cp.foto);
        if (fname) cp.foto = fname;
      }
      fileList.push(cp);
    }
    await this._writeFile(this.K.PRODUCTOS, fileList);
  },

  // Lee productos del disco: hidrata refs de imagen con base64 desde archivos
  async _readProductosFromFile() {
    if (!this._dirHandle) return null;
    try {
      const fh   = await this._dirHandle.getFileHandle(`${this.K.PRODUCTOS}.json`);
      const file = await fh.getFile();
      const list = JSON.parse(await file.text());
      for (const p of list) {
        if (p.foto && !p.foto.startsWith('data:') && p.foto.startsWith('img_')) {
          p.foto = await this._readImageFile(p.foto) || null;
        }
      }
      return list;
    } catch { return null; }
  },

  // ── Core get / set ─────────────────────────────────────────────────────────
  _get(key) {
    try {
      if (this._cache[key] !== undefined) return this._cache[key];
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  },
  _set(key, val) {
    this._cache[key] = val;
    localStorage.setItem(key, JSON.stringify(val));
    if (this._dirHandle) this._writeFile(key, val);
    if (typeof GitHub !== 'undefined') GitHub.autoSync();
  },

  uuid()  { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); },
  today() { return new Date().toISOString().split('T')[0]; },

  // CONFIG
  getConfig() {
    try {
      const c = this._cache[this.K.CONFIG]
             || JSON.parse(localStorage.getItem(this.K.CONFIG));
      return c || { nombreNegocio:'ImportApp', porcentajeDefault:40 };
    } catch { return { nombreNegocio:'ImportApp', porcentajeDefault:40 }; }
  },
  saveConfig(c) {
    this._cache[this.K.CONFIG] = c;
    localStorage.setItem(this.K.CONFIG, JSON.stringify(c));
    if (this._dirHandle) this._writeFile(this.K.CONFIG, c);
    if (typeof GitHub !== 'undefined') GitHub.autoSync();
  },

  // PRODUCTOS
  getProductos()    { return this._get(this.K.PRODUCTOS); },
  getProducto(id)   { return this.getProductos().find(p => p.id === id); },
  saveProducto(p)   {
    const list = this.getProductos();
    if (!p.id) { p.id = this.uuid(); p.fechaIngreso = this.today(); }
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = p; else list.push(p);
    // Mantener base64 en memoria y localStorage; en carpeta guardar imágenes como archivos
    this._cache[this.K.PRODUCTOS] = list;
    localStorage.setItem(this.K.PRODUCTOS, JSON.stringify(list));
    if (this._dirHandle) this._writeProductosFile(list);
    if (typeof GitHub !== 'undefined') GitHub.autoSync();
    return p;
  },
  deleteProducto(id){
    const list = this.getProductos().filter(p => p.id !== id);
    this._cache[this.K.PRODUCTOS] = list;
    localStorage.setItem(this.K.PRODUCTOS, JSON.stringify(list));
    if (this._dirHandle) {
      this._writeProductosFile(list);
      this._deleteImageFile(id);
    }
    if (typeof GitHub !== 'undefined') GitHub.autoSync();
  },

  // IMPORTACIONES
  getImportaciones()   { return this._get(this.K.IMPORTACIONES); },
  getImportacion(id)   { return this.getImportaciones().find(p => p.id === id); },
  saveImportacion(p)   {
    const list = this.getImportaciones();
    if (!p.id) p.id = this.uuid();
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = p; else list.push(p);
    this._set(this.K.IMPORTACIONES, list);
    return p;
  },
  deleteImportacion(id){ this._set(this.K.IMPORTACIONES, this.getImportaciones().filter(p => p.id !== id)); },

  // CLIENTES
  getClientes()    { return this._get(this.K.CLIENTES); },
  getCliente(id)   { return this.getClientes().find(c => c.id === id); },
  saveCliente(c)   {
    const list = this.getClientes();
    if (!c.id) { c.id = this.uuid(); c.fechaRegistro = this.today(); }
    const i = list.findIndex(x => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    this._set(this.K.CLIENTES, list);
    return c;
  },
  deleteCliente(id){ this._set(this.K.CLIENTES, this.getClientes().filter(c => c.id !== id)); },

  // VENTAS
  getVentas()   { return this._get(this.K.VENTAS); },
  getVenta(id)  { return this.getVentas().find(v => v.id === id); },
  saveVenta(v)  {
    const list = this.getVentas();
    if (!v.id) { v.id = this.uuid(); v.fecha = this.today(); }
    const i = list.findIndex(x => x.id === v.id);
    if (i >= 0) list[i] = v; else list.push(v);
    this._set(this.K.VENTAS, list);
    return v;
  },

  // ABONOS
  getAbonos()            { return this._get(this.K.ABONOS); },
  getAbonosByVenta(vid)  { return this.getAbonos().filter(a => a.ventaId === vid); },
  getAbonosByCliente(cid){ return this.getAbonos().filter(a => a.clienteId === cid); },
  saveAbono(a) {
    const list = this.getAbonos();
    a.id = this.uuid();
    list.push(a);
    this._set(this.K.ABONOS, list);
    return a;
  },
  deleteAbono(id){ this._set(this.K.ABONOS, this.getAbonos().filter(a => a.id !== id)); },

  // ── Helpers de importación ─────────────────────────────────────────────────
  recibirImportacion(importacionId) {
    const imp = this.getImportacion(importacionId);
    if (!imp || imp.estado === 'entregado') return;
    const items      = imp.productos || [];
    const pesoTotal  = items.reduce((s, i) => s + parseFloat(i.pesoTotal || 0), 0);
    // Distribuir courier + costo envío + impuestos proporcionalmente por peso
    const totalExtra = (parseFloat(imp.valorCourier) || 0)
                     + (parseFloat(imp.costoEnvio)   || 0)
                     + (parseFloat(imp.impuestos)    || 0);
    const cfg = this.getConfig();

    items.forEach(item => {
      const p = this.getProducto(item.productoId);
      if (!p) return;
      const pesoItem  = parseFloat(item.pesoTotal || 0);
      const extraProp = pesoTotal > 0 ? (pesoItem / pesoTotal) * totalExtra : 0;
      const unidades  = parseInt(item.unidades) || 1;
      const extUnit   = unidades > 0 ? extraProp / unidades : 0;
      const invTotal  = parseFloat(p.costoAmazon || 0) + extUnit;
      const pct       = parseFloat(p.porcentajeGanancia) || (cfg.porcentajeDefault || 40);
      p.costoCourier  = Math.round(extUnit   * 100) / 100;  // costo adicional total por unidad
      p.inversionTotal= Math.round(invTotal  * 100) / 100;
      p.precioVenta   = Math.round(invTotal * (1 + pct / 100) * 100) / 100;
      p.stock         = (parseInt(p.stock) || 0) + unidades;
      p.estado        = 'disponible';
      p.trackingStatus= 'recibido';
      p.importacionId = importacionId;
      this.saveProducto(p);
    });

    imp.estado         = 'entregado';
    imp.fechaEntregado = this.today();
    this.saveImportacion(imp);
  },

  // ── Saldos ─────────────────────────────────────────────────────────────────
  getSaldoVenta(ventaId) {
    const v = this.getVenta(ventaId);
    if (!v) return 0;
    const abonado = this.getAbonosByVenta(ventaId).reduce((s, a) => s + parseFloat(a.monto || 0), 0);
    return Math.max(0, parseFloat(v.total) - parseFloat(v.pagadoInicial || 0) - abonado);
  },
  getSaldoCliente(clienteId) {
    return this.getVentas()
      .filter(v => v.clienteId === clienteId)
      .reduce((s, v) => s + this.getSaldoVenta(v.id), 0);
  },
  getTotalVentasCliente(clienteId) {
    return this.getVentas()
      .filter(v => v.clienteId === clienteId)
      .reduce((s, v) => s + parseFloat(v.total || 0), 0);
  },

  // ── Formato ────────────────────────────────────────────────────────────────
  fmt(n)     { return '$' + (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
  fmtDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  },

  // ── CSV Export ─────────────────────────────────────────────────────────────
  _toCSV(nombre, rows) {
    if (!rows || !rows.length) return;
    const keys  = Object.keys(rows[0]);
    const lines = [
      keys.join(';'),
      ...rows.map(r => keys.map(k => {
        const v = r[k] == null ? '' : r[k];
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return (s.includes(';') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(';'))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${nombre}_${this.today()}.csv`;
    a.click();
  },

  // ── Excel Backup ───────────────────────────────────────────────────────────
  exportarExcel() {
    const wb = XLSX.utils.book_new();

    // Productos — foto se reemplaza por placeholder (base64 haría el archivo enorme)
    const prods = this.getProductos().map(p => ({ ...p, foto: p.foto ? '[imagen]' : '' }));
    if (prods.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prods),  'Productos');

    // Importaciones — array de productos se serializa como JSON
    const imps  = this.getImportaciones().map(i => ({ ...i, productos: JSON.stringify(i.productos || []) }));
    if (imps.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(imps),   'Importaciones');

    // Clientes
    const clis  = this.getClientes();
    if (clis.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clis),   'Clientes');

    // Ventas — items como JSON
    const vtas  = this.getVentas().map(v => ({ ...v, items: JSON.stringify(v.items || []) }));
    if (vtas.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vtas),   'Ventas');

    // Abonos
    const abns  = this.getAbonos();
    if (abns.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abns),   'Abonos');

    // Config — una sola fila
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ ...this.getConfig(), logo: this.getConfig().logo ? '[imagen]' : '' }]), 'Config');

    if (wb.SheetNames.length === 0) { App.toast('Sin datos para exportar', 'warning'); return; }

    XLSX.writeFile(wb, `importapp_backup_${this.today()}.xlsx`);
    App.toast('Backup Excel exportado (fotos no incluidas — usa JSON para preservarlas)', 'success');
  },

  importarExcel(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const hoja = name => {
            const ws = wb.Sheets[name];
            return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : null;
          };

          const prods = hoja('Productos');
          if (prods) {
            this._set(this.K.PRODUCTOS, prods.map(p => ({
              ...p,
              foto: (p.foto === '[imagen]' || !p.foto) ? null : p.foto
            })));
          }

          const imps = hoja('Importaciones');
          if (imps) {
            this._set(this.K.IMPORTACIONES, imps.map(i => ({
              ...i,
              productos: typeof i.productos === 'string'
                ? (() => { try { return JSON.parse(i.productos); } catch { return []; } })()
                : (i.productos || [])
            })));
          }

          const clis = hoja('Clientes');
          if (clis) this._set(this.K.CLIENTES, clis);

          const vtas = hoja('Ventas');
          if (vtas) {
            this._set(this.K.VENTAS, vtas.map(v => ({
              ...v,
              items: typeof v.items === 'string'
                ? (() => { try { return JSON.parse(v.items); } catch { return []; } })()
                : (v.items || [])
            })));
          }

          const abns = hoja('Abonos');
          if (abns) this._set(this.K.ABONOS, abns);

          const cfgRows = hoja('Config');
          if (cfgRows && cfgRows.length) {
            const c = cfgRows[0];
            this.saveConfig({ ...c, logo: (c.logo === '[imagen]' || !c.logo) ? null : c.logo });
          }

          res(true);
        } catch (err) { rej(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  exportarTodo() {
    this._toCSV('productos',     this.getProductos().map(p => ({ ...p, foto: p.foto ? '[imagen_base64]' : '' })));
    this._toCSV('importaciones', this.getImportaciones());
    this._toCSV('clientes',      this.getClientes());
    this._toCSV('ventas',        this.getVentas().map(v => ({ ...v, items: JSON.stringify(v.items) })));
    this._toCSV('abonos',        this.getAbonos());
    App.toast('CSVs exportados correctamente', 'success');
  },

  importarJSON(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.productos) {
            // Mantener base64 en memoria/localStorage; escribir archivos de imagen en carpeta
            this._cache[this.K.PRODUCTOS] = data.productos;
            localStorage.setItem(this.K.PRODUCTOS, JSON.stringify(data.productos));
            if (this._dirHandle) this._writeProductosFile(data.productos);
          }
          if (data.importaciones) this._set(this.K.IMPORTACIONES, data.importaciones);
          if (data.clientes)      this._set(this.K.CLIENTES,      data.clientes);
          if (data.ventas)        this._set(this.K.VENTAS,        data.ventas);
          if (data.abonos)        this._set(this.K.ABONOS,        data.abonos);
          if (data.config)        this.saveConfig(data.config);
          res(true);
        } catch (err) { rej(err); }
      };
      r.readAsText(file);
    });
  },

  exportarJSON() {
    const data = {
      productos:     this.getProductos(),
      importaciones: this.getImportaciones(),
      clientes:      this.getClientes(),
      ventas:        this.getVentas(),
      abonos:        this.getAbonos(),
      config:        this.getConfig()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `importapp_backup_${this.today()}.json`;
    a.click();
    App.toast('Backup exportado', 'success');
  }
};
