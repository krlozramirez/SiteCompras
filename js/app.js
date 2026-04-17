const App = {
  views: {
    inventario:    () => Inventario.render(),
    importaciones: () => Importaciones.render(),
    clientes:      () => Clientes.render(),
    ventas:        () => Ventas.render(),
    cartera:       () => Cartera.render(),
    catalogo:      () => Catalogo.render(),
    reportes:      () => Reportes.render(),
    config:        () => Config.render()
  },
  _charts: [],

  async init() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(link.dataset.view);
      });
    });

    const splash = msg =>
      document.getElementById('view-container').innerHTML =
        `<div style="padding:60px;text-align:center;color:var(--text-secondary);font-size:14px">${msg}</div>`;

    splash('Cargando datos...');
    await Storage.initStorage();

    if (GitHub.isConfigured()) {
      splash('⬇️ Sincronizando con GitHub...');
      try {
        await GitHub.pullAll();
        await GitHub._refreshLastCommitSha(); // punto de referencia para el polling
      } catch(e) {
        this.toast('Sin conexión a GitHub. Usando datos locales.', 'warning');
      }
      GitHub.startPolling(30000); // revisar cambios externos cada 30 segundos
    }

    this._applyConfig();
    this.updateSyncBtn();

    const hash = location.hash.replace('#', '');
    this.navigate(this.views[hash] ? hash : 'inventario');
  },

  navigate(view) {
    if (!this.views[view]) view = 'inventario';

    // Destroy existing Chart.js instances
    this._charts.forEach(c => { try { c.destroy(); } catch {} });
    this._charts = [];

    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.view === view));

    location.hash = view;
    document.getElementById('view-container').innerHTML = '';
    this.views[view]();
  },

  registerChart(instance) { this._charts.push(instance); },

  _applyConfig() {
    const cfg = Storage.getConfig();
    const el = document.getElementById('sidebar-title');
    if (el) el.textContent = cfg.nombreNegocio || 'ImportApp';
    if (cfg.logo) {
      const wrap = document.getElementById('sidebar-logo-wrap');
      const img  = document.getElementById('sidebar-logo');
      if (wrap && img) { img.src = cfg.logo; wrap.style.display = 'block'; }
    }
  },

  reloadConfig() { this._applyConfig(); },

  async syncData() {
    const btn  = document.getElementById('sync-btn');
    const icon = btn?.querySelector('.sync-icon');
    const lbl  = btn?.querySelector('.sync-label');
    if (!btn) return;

    const hasFolder = !!Storage.getFolderName();
    const hasGitHub = GitHub.isConfigured();

    if (!hasFolder && !hasGitHub) {
      App.toast('Configura una carpeta o GitHub en Configuración', 'warning');
      App.navigate('config');
      return;
    }

    btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (lbl)  lbl.textContent  = 'Guardando...';

    const destinos = [];
    let hayError = false;

    if (hasFolder) {
      const result = await Storage.syncAll();
      if (result.ok) destinos.push('carpeta');
      else { hayError = true; App.toast('Error al guardar en carpeta local', 'error'); }
    }

    if (hasGitHub) {
      try {
        await GitHub.syncAll();
        destinos.push('GitHub');
      } catch(e) {
        hayError = true;
        App.toast('Error GitHub: ' + e.message, 'error');
      }
    }

    if (destinos.length) {
      btn.className = 'sync-btn sync-ok';
      if (icon) icon.textContent = '✅';
      if (lbl)  lbl.textContent  = 'Guardado';
      App.toast('Guardado en: ' + destinos.join(' y '), 'success');
      setTimeout(() => { btn.disabled = false; App.updateSyncBtn(); }, 2000);
    } else {
      if (icon) icon.textContent = '⚠️';
      if (lbl)  lbl.textContent  = 'Error';
      btn.disabled = false;
      setTimeout(() => App.updateSyncBtn(), 3000);
    }
  },

  updateSyncBtn() {
    const btn    = document.getElementById('sync-btn');
    const status = document.getElementById('sync-status');
    if (!btn) return;

    const folder = Storage.getFolderName();
    const ghCfg  = GitHub.isConfigured() ? GitHub.getConfig() : null;
    btn.disabled = false;
    const icon = btn.querySelector('.sync-icon');
    const lbl  = btn.querySelector('.sync-label');

    if (folder || ghCfg) {
      btn.className = 'sync-btn sync-active';
      if (icon) icon.textContent = '💾';
      if (lbl)  lbl.textContent  = 'Sincronizar';
      if (status) {
        const parts = [];
        if (folder) parts.push(`📁 ${folder}`);
        if (ghCfg)  parts.push(`🐙 ${ghCfg.owner}/${ghCfg.repo}`);
        status.textContent = parts.join(' · ');
      }
    } else {
      btn.className = 'sync-btn sync-inactive';
      if (icon) icon.textContent = '💾';
      if (lbl)  lbl.textContent  = 'Sin sincronizar';
      if (status) status.textContent = 'Configurar en ⚙️';
    }
  },

  // ── Modal ──
  openModal(title, bodyHtml, large = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal').className = 'modal' + (large ? ' modal-lg' : '');
    document.getElementById('modal-overlay').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-body').innerHTML = '';
  },

  // ── Toast ──
  toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },

  // ── Confirm dialog ──
  confirm(msg, cb) {
    const html = `
      <p style="margin-bottom:20px;color:#475569;line-height:1.6">${msg}</p>
      <div class="modal-footer" style="padding:0">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-danger" id="confirm-yes">Confirmar</button>
      </div>`;
    this.openModal('¿Estás seguro?', html);
    document.getElementById('confirm-yes').onclick = () => { this.closeModal(); cb(); };
  }
};

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') App.closeModal();
});

document.addEventListener('DOMContentLoaded', () => App.init());
