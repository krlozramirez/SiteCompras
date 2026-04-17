const GitHub = {
  _KEY:       'imp_github_cfg',
  _syncTimer: null,
  _syncing:   false,
  _suppress:  false,   // true durante pull para evitar loop pull→_set→autoSync

  getConfig() {
    try { return JSON.parse(localStorage.getItem(this._KEY)) || {}; }
    catch { return {}; }
  },

  saveConfig(c) { localStorage.setItem(this._KEY, JSON.stringify(c)); },

  isConfigured() {
    const c = this.getConfig();
    return !!(c.token && c.owner && c.repo && c.branch);
  },

  _headers(token) {
    return {
      'Authorization': `Bearer ${token || this.getConfig().token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  },

  // JSON → base64 con soporte UTF-8 (acentos, ñ, etc.)
  _encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  },

  // base64 → JSON con soporte UTF-8
  _decode(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  },

  async _getSha(path) {
    const { owner, repo, branch, token } = this.getConfig();
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: this._headers(token) }
    );
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return d.sha;
  },

  async getFile(path) {
    const { owner, repo, branch, token } = this.getConfig();
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: this._headers(token) }
    );
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return { content: this._decode(d.content), sha: d.sha };
  },

  async putFile(path, data, sha) {
    const { owner, repo, branch, token } = this.getConfig();
    const body = {
      message: `importapp: sync ${new Date().toISOString().slice(0, 10)}`,
      content: this._encode(data),
      branch
    };
    if (sha) body.sha = sha;
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { method: 'PUT', headers: this._headers(token), body: JSON.stringify(body) }
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(`HTTP ${r.status}: ${e.message || 'Error desconocido'}`);
    }
  },

  // Verifica conexión con credenciales dadas directamente (sin requerir config guardada)
  async testConnection(owner, repo, token) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: this._headers(token) }
    );
    if (r.status === 401) throw new Error('Token inválido o sin permisos');
    if (r.status === 404) throw new Error('Repositorio no encontrado (¿es privado?)');
    if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
    const d = await r.json();
    return { name: d.full_name, private: d.private };
  },

  // ── Auto-sync: se llama tras cada modificación, debounce de 2.5s ──────────
  autoSync() {
    if (!this.isConfigured() || this._suppress) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this._doAutoSync(), 2500);
  },

  async _doAutoSync() {
    if (this._syncing) {
      // Ya hay un sync en curso, reprogramar
      this._syncTimer = setTimeout(() => this._doAutoSync(), 2000);
      return;
    }
    this._syncing = true;
    const btn  = document.getElementById('sync-btn');
    const icon = btn?.querySelector('.sync-icon');
    const lbl  = btn?.querySelector('.sync-label');
    if (icon) icon.textContent = '⏳';
    if (lbl)  lbl.textContent  = 'Guardando...';
    try {
      await this.syncAll();
      if (icon) icon.textContent = '✅';
      if (lbl)  lbl.textContent  = 'Guardado';
      setTimeout(() => { if (typeof App !== 'undefined') App.updateSyncBtn(); }, 1500);
    } catch(e) {
      console.warn('[GitHub] Auto-sync error:', e.message);
      if (icon) icon.textContent = '⚠️';
      if (lbl)  lbl.textContent  = 'Error sync';
      setTimeout(() => { if (typeof App !== 'undefined') App.updateSyncBtn(); }, 3000);
    } finally {
      this._syncing = false;
    }
  },

  // ── Sube todos los datos a GitHub (imágenes excluidas por tamaño) ──────────
  async syncAll() {
    const cfg = Storage.getConfig();
    const files = {
      'imp_productos.json':     Storage.getProductos().map(p => ({ ...p, foto: p.foto ? '[imagen]' : null })),
      'imp_importaciones.json': Storage.getImportaciones(),
      'imp_clientes.json':      Storage.getClientes(),
      'imp_ventas.json':        Storage.getVentas(),
      'imp_abonos.json':        Storage.getAbonos(),
      'imp_config.json':        { ...cfg, logo: cfg.logo ? '[imagen]' : null }
    };

    const errors = [];
    for (const [path, data] of Object.entries(files)) {
      try {
        const sha = await this._getSha(path);
        await this.putFile(path, data, sha);
      } catch(e) {
        errors.push(`${path}: ${e.message}`);
      }
    }

    if (errors.length) throw new Error(errors.join('\n'));
  },

  // ── Baja todos los datos de GitHub (imágenes se preservan localmente) ──────
  async pullAll() {
    this._suppress = true;  // evita que los _set() disparen auto-sync
    try {
      // Productos: restaurar imágenes desde datos locales por ID
      const prodResult = await this.getFile('imp_productos.json');
      if (prodResult) {
        const localProds = Storage.getProductos();
        const merged = prodResult.content.map(p => {
          if (p.foto === '[imagen]') {
            const local = localProds.find(lp => lp.id === p.id);
            return { ...p, foto: local?.foto || null };
          }
          return p;
        });
        Storage._cache[Storage.K.PRODUCTOS] = merged;
        localStorage.setItem(Storage.K.PRODUCTOS, JSON.stringify(merged));
        if (Storage._dirHandle) Storage._writeProductosFile(merged);
      }

      // Tablas sin imágenes
      const tables = [
        ['imp_importaciones.json', Storage.K.IMPORTACIONES],
        ['imp_clientes.json',      Storage.K.CLIENTES],
        ['imp_ventas.json',        Storage.K.VENTAS],
        ['imp_abonos.json',        Storage.K.ABONOS],
      ];
      for (const [file, key] of tables) {
        const result = await this.getFile(file);
        if (result) Storage._set(key, result.content);
      }

      // Config: preservar logo local
      const cfgResult = await this.getFile('imp_config.json');
      if (cfgResult) {
        const localCfg = Storage.getConfig();
        const remote = cfgResult.content;
        if (remote.logo === '[imagen]') remote.logo = localCfg.logo || null;
        Storage.saveConfig(remote);
      }
    } finally {
      this._suppress = false;
    }
  }
};
