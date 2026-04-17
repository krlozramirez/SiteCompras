const GitHub = {
  _KEY:           'imp_github_cfg',
  _syncTimer:     null,
  _syncing:       false,
  _suppress:      false,   // true durante pull para evitar loop pull→_set→autoSync
  _pollTimer:     null,
  _lastCommitSha: null,    // SHA del último commit conocido para detectar cambios externos

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
      await this._refreshLastCommitSha(); // registrar SHA para que el poll no re-baje lo nuestro
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

  // ── Polling: detecta cambios de otros dispositivos cada 30 segundos ────────
  startPolling(intervalMs = 30000) {
    if (!this.isConfigured()) return;
    clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => this._checkForUpdates(), intervalMs);
  },

  stopPolling() {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
  },

  async _refreshLastCommitSha() {
    try {
      const { owner, repo, branch, token } = this.getConfig();
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
        { headers: this._headers(token) }
      );
      if (r.ok) this._lastCommitSha = (await r.json()).sha;
    } catch {}
  },

  async _checkForUpdates() {
    if (!this.isConfigured() || this._syncing || this._suppress) return;
    // No refrescar si hay un modal abierto (el usuario puede estar editando un formulario)
    const modalAbierto = document.getElementById('modal-overlay')?.style.display !== 'none';
    if (modalAbierto) return;

    try {
      const { owner, repo, branch, token } = this.getConfig();
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
        { headers: this._headers(token) }
      );
      if (!r.ok) return;
      const sha = (await r.json()).sha;

      if (this._lastCommitSha && sha !== this._lastCommitSha) {
        // Hay cambios de otro dispositivo — bajar y refrescar vista
        this._lastCommitSha = sha;
        await this.pullAll();
        if (typeof App !== 'undefined') {
          const vista = location.hash.replace('#', '') || 'inventario';
          if (App.views[vista]) App.views[vista]();
          App.toast('✨ Datos actualizados desde otro dispositivo', 'info');
        }
      } else {
        this._lastCommitSha = sha;
      }
    } catch(e) {
      console.warn('[GitHub] Poll error:', e.message);
    }
  },

  // Une dos arrays por ID: local gana en conflicto, items solo en remoto se conservan
  _mergeArrays(local, remote) {
    const localIds = new Set(local.map(x => x.id));
    const soloRemoto = remote.filter(x => !localIds.has(x.id));
    return [...local, ...soloRemoto];
  },

  // ── Sube todos los datos a GitHub con merge para no pisar cambios de otro dispositivo ──
  async syncAll() {
    const cfg    = Storage.getConfig();
    const errors = [];

    // Tablas de arrays: merge local + remoto antes de subir
    const tablas = [
      { file: 'imp_importaciones.json', key: Storage.K.IMPORTACIONES, getData: () => Storage.getImportaciones() },
      { file: 'imp_clientes.json',      key: Storage.K.CLIENTES,      getData: () => Storage.getClientes() },
      { file: 'imp_ventas.json',        key: Storage.K.VENTAS,        getData: () => Storage.getVentas() },
      { file: 'imp_abonos.json',        key: Storage.K.ABONOS,        getData: () => Storage.getAbonos() },
    ];

    for (const { file, key, getData } of tablas) {
      try {
        const remoto  = await this.getFile(file);
        const local   = getData();
        const merged  = remoto ? this._mergeArrays(local, remoto.content) : local;
        await this.putFile(file, merged, remoto?.sha);
        // Actualizar local con el resultado del merge (sin pasar por _set para no re-disparar autoSync)
        Storage._cache[key] = merged;
        localStorage.setItem(key, JSON.stringify(merged));
      } catch(e) { errors.push(`${file}: ${e.message}`); }
    }

    // Productos: merge + manejo especial de imágenes
    try {
      const remoto        = await this.getFile('imp_productos.json');
      const localProds    = Storage.getProductos();
      const localSinFoto  = localProds.map(p => ({ ...p, foto: p.foto ? '[imagen]' : null }));
      const merged        = remoto ? this._mergeArrays(localSinFoto, remoto.content) : localSinFoto;
      await this.putFile('imp_productos.json', merged, remoto?.sha);
      // Restaurar imágenes locales en el resultado del merge
      const mergedConFoto = merged.map(p => {
        if (p.foto === '[imagen]') {
          const lp = localProds.find(x => x.id === p.id);
          return { ...p, foto: lp?.foto || null };
        }
        return p;
      });
      Storage._cache[Storage.K.PRODUCTOS] = mergedConFoto;
      localStorage.setItem(Storage.K.PRODUCTOS, JSON.stringify(mergedConFoto));
      if (Storage._dirHandle) Storage._writeProductosFile(mergedConFoto);
    } catch(e) { errors.push(`imp_productos.json: ${e.message}`); }

    // Config: solo sube local (los cambios de config son intencionales)
    try {
      const sha = await this._getSha('imp_config.json');
      await this.putFile('imp_config.json', { ...cfg, logo: cfg.logo ? '[imagen]' : null }, sha);
    } catch(e) { errors.push(`imp_config.json: ${e.message}`); }

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
