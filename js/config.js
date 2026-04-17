const Config = {
  render() {
    const cfg    = Storage.getConfig();
    const ghCfg  = GitHub.getConfig();

    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">⚙️ Configuración</h1>
          <p class="page-subtitle">Ajustes del negocio y gestión de datos</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">🏪 Información del negocio</div></div>

        <div class="form-row">
          <div class="form-group">
            <label>Nombre del negocio</label>
            <input class="form-control" id="cfg-nombre" placeholder="Mi Tienda" value="${cfg.nombreNegocio||''}">
          </div>
          <div class="form-group">
            <label>% Ganancia por defecto</label>
            <input class="form-control" id="cfg-pct" type="number" min="0" placeholder="40" value="${cfg.porcentajeDefault||40}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tarifa courier por defecto (USD / lb)</label>
            <input class="form-control" id="cfg-tarifa" type="number" step="0.01" min="0" placeholder="8.00" value="${cfg.tarifaCourier||8}">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Se usa como valor inicial al crear una importación. Puedes ajustarlo por importación.</div>
          </div>
          <div class="form-group">
            <label>Unidad de peso</label>
            <select class="form-control" id="cfg-peso-unit">
              <option value="lbs" ${(cfg.pesoUnidad||'lbs')==='lbs'?'selected':''}>Libras (lbs)</option>
              <option value="kg"  ${cfg.pesoUnidad==='kg'?'selected':''}>Kilogramos (kg)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Color del catálogo PDF</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <input type="color" id="cfg-cat-color" value="${cfg.catalogColor||'#ec4899'}"
              style="width:52px;height:38px;padding:3px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:#fff">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${[
                ['#ec4899','Rosa'],['#f97316','Naranja'],['#a855f7','Violeta'],
                ['#06b6d4','Celeste'],['#10b981','Verde'],['#ef4444','Rojo'],
                ['#eab308','Amarillo'],['#6366f1','Morado']
              ].map(([c,n]) =>
                `<button type="button" title="${n}" onclick="document.getElementById('cfg-cat-color').value='${c}'"
                  style="width:28px;height:28px;background:${c};border:2px solid transparent;border-radius:6px;cursor:pointer;transition:transform .1s"
                  onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform=''"
                ></button>`
              ).join('')}
            </div>
            <span style="font-size:11px;color:var(--text-secondary)">Encabezado y precios del catálogo PDF</span>
          </div>
        </div>

        <div class="form-group">
          <label>Logo del negocio</label>
          <div class="photo-upload" onclick="document.getElementById('cfg-logo-inp').click()">
            <input type="file" id="cfg-logo-inp" accept="image/*" style="display:none" onchange="Config._previewLogo(this)">
            <div id="cfg-logo-wrap">
              ${cfg.logo
                ? `<img src="${cfg.logo}" style="max-height:80px;border-radius:8px" id="cfg-logo-prev">`
                : `<div id="cfg-logo-prev" style="font-size:28px">🏪</div><div style="font-size:12px;margin-top:4px">Clic para subir logo</div>`}
            </div>
          </div>
          ${cfg.logo ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="Config._borrarLogo()">✕ Quitar logo</button>` : ''}
        </div>

        <div class="form-group">
          <label>Notas / Descripción del negocio</label>
          <textarea class="form-control" id="cfg-notas" rows="2" placeholder="Descripción para el catálogo PDF...">${cfg.notas||''}</textarea>
        </div>

        <button class="btn btn-primary" onclick="Config.save()">💾 Guardar configuración</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">📁 Carpeta de datos (JSON en disco)</div></div>
        ${Storage.getFolderName() ? `
          <div style="display:flex;align-items:center;gap:10px;background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;margin-bottom:14px">
            <span style="font-size:20px">✅</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">Carpeta activa: <code style="background:#fff;padding:2px 6px;border-radius:4px">${Storage.getFolderName()}</code></div>
              <div style="font-size:11px;color:#065f46;margin-top:2px">Los cambios se guardan automáticamente como archivos JSON en esa carpeta.</div>
            </div>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="Config._desconectarCarpeta()">Desconectar</button>
          </div>` : `
          <div style="display:flex;align-items:center;gap:10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin-bottom:14px">
            <span style="font-size:20px">⚠️</span>
            <div>
              <div style="font-weight:700;font-size:13px">Usando localStorage del navegador</div>
              <div style="font-size:11px;color:#92400e;margin-top:2px">Los datos podrían perderse si limpias el navegador. Selecciona una carpeta para guardar directamente en disco.</div>
            </div>
          </div>`}
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.6">
          Al seleccionar una carpeta, la app leerá y escribirá archivos JSON directamente ahí
          (<code>imp_productos.json</code>, <code>imp_clientes.json</code>, etc.). Los datos sobreviven
          aunque limpies el navegador. Requiere <strong>Chrome o Edge</strong>.
        </p>
        <button class="btn btn-primary" onclick="Config._seleccionarCarpeta()">${Storage.getFolderName() ? '📁 Cambiar carpeta' : '📁 Seleccionar carpeta de datos'}</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">🐙 GitHub — Sincronización en la nube</div></div>

        ${ghCfg.owner ? `
          <div style="display:flex;align-items:center;gap:10px;background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;margin-bottom:14px">
            <span style="font-size:20px">✅</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">Conectado: <code style="background:#fff;padding:2px 6px;border-radius:4px">${ghCfg.owner}/${ghCfg.repo}</code> · branch <code style="background:#fff;padding:2px 6px;border-radius:4px">${ghCfg.branch}</code></div>
              <div style="font-size:11px;color:#065f46;margin-top:2px">Al sincronizar, los datos se guardan en GitHub. Las imágenes quedan solo localmente.</div>
            </div>
          </div>` : `
          <div style="display:flex;align-items:center;gap:10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin-bottom:14px">
            <span style="font-size:20px">☁️</span>
            <div>
              <div style="font-weight:700;font-size:13px">No configurado</div>
              <div style="font-size:11px;color:#92400e;margin-top:2px">Configura un repositorio privado en GitHub para acceder a tus datos desde cualquier máquina.</div>
            </div>
          </div>`}

        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6">
          Los archivos JSON se guardan directamente en un repositorio de GitHub usando la API.
          Necesitas: (1) un <strong>repositorio privado</strong> creado en github.com y
          (2) un <strong>Personal Access Token</strong> con permiso <code>repo</code>
          (GitHub → Settings → Developer settings → Personal access tokens → Tokens classic).
          <br><strong>Nota:</strong> las imágenes de productos <em>no se sincronizan</em> (demasiado grandes); quedan guardadas localmente.
        </p>

        <div class="form-row">
          <div class="form-group">
            <label>Usuario de GitHub</label>
            <input class="form-control" id="cfg-gh-owner" placeholder="tu-usuario" value="${ghCfg.owner || ''}">
          </div>
          <div class="form-group">
            <label>Nombre del repositorio</label>
            <input class="form-control" id="cfg-gh-repo" placeholder="importapp-datos" value="${ghCfg.repo || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Branch</label>
            <input class="form-control" id="cfg-gh-branch" placeholder="main" value="${ghCfg.branch || 'main'}">
          </div>
          <div class="form-group">
            <label>Personal Access Token <span style="font-size:11px;color:var(--text-secondary)">(guardado solo en este navegador)</span></label>
            <input class="form-control" id="cfg-gh-token" type="password" placeholder="ghp_xxxxxxxxxxxx" value="${ghCfg.token || ''}">
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${ghCfg.token ? '14px' : '0'}">
          <button class="btn btn-ghost btn-sm" onclick="Config._testGitHub()">🔍 Probar conexión</button>
          <button class="btn btn-primary btn-sm" onclick="Config._saveGitHub()">💾 Guardar configuración</button>
          ${ghCfg.token ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="Config._desconectarGitHub()">✕ Desconectar</button>` : ''}
        </div>

        ${GitHub.isConfigured() ? `
          <div style="border-top:1px solid var(--border);padding-top:14px">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
              También puedes subir o bajar datos manualmente desde aquí:
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="Config._pushGitHub()">⬆️ Subir datos a GitHub</button>
              <button class="btn btn-ghost btn-sm" onclick="Config._pullGitHub()">⬇️ Bajar datos de GitHub</button>
            </div>
          </div>` : ''}
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">💾 Respaldo de datos</div></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">📦 Backup JSON <span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:99px">Recomendado</span></div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">Incluye todo: datos + fotos. Ideal para respaldar completamente.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="Storage.exportarJSON()">⬇️ Exportar</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('imp-json').click()">⬆️ Restaurar</button>
              <input type="file" id="imp-json" accept=".json" style="display:none" onchange="Config.importar(this)">
            </div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">📊 Backup Excel (.xlsx)</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">Una hoja por módulo. Las fotos no se incluyen. Se puede abrir en Excel para revisar.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="Storage.exportarExcel()">⬇️ Exportar</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('imp-xlsx').click()">⬆️ Restaurar</button>
              <input type="file" id="imp-xlsx" accept=".xlsx,.xls" style="display:none" onchange="Config.importarExcel(this)">
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="Storage.exportarTodo()">⬇️ Exportar CSVs individuales</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">📊 Estadísticas de almacenamiento</div></div>
        <div id="cfg-storage-stats">${this._storageStats()}</div>
      </div>

      <div class="card" style="border-color:var(--danger)">
        <div class="card-header"><div class="card-title" style="color:var(--danger)">⚠️ Zona peligrosa</div></div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
          Estas acciones eliminan datos permanentemente. Haz un backup antes de continuar.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="Config.borrarModulo('ventas')">Borrar ventas</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="Config.borrarModulo('productos')">Borrar productos</button>
          <button class="btn btn-danger btn-sm" onclick="Config.borrarTodo()">🗑️ Borrar todo</button>
        </div>
      </div>`;

    window._logoActual = cfg.logo || null;
  },

  _previewLogo(inp) {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 300;
        let [w, h] = [img.width, img.height];
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h*max/w); w = max; }
          else       { w = Math.round(w*max/h); h = max; }
        }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        window._logoActual = canvas.toDataURL('image/png', 0.8);
        document.getElementById('cfg-logo-wrap').innerHTML =
          `<img src="${window._logoActual}" style="max-height:80px;border-radius:8px" id="cfg-logo-prev">`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _borrarLogo() {
    window._logoActual = null;
    document.getElementById('cfg-logo-wrap').innerHTML =
      `<div style="font-size:28px">🏪</div><div style="font-size:12px;margin-top:4px">Clic para subir logo</div>`;
  },

  _storageStats() {
    const items = [
      ['Productos',     Storage.getProductos().length],
      ['Importaciones', Storage.getImportaciones().length],
      ['Clientes',      Storage.getClientes().length],
      ['Ventas',        Storage.getVentas().length],
      ['Abonos',        Storage.getAbonos().length],
    ];
    let used = 0;
    try { used = JSON.stringify(localStorage).length / 1024; } catch {}
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">
        ${items.map(([label,cnt])=>`
          <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700">${cnt}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${label}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--text-secondary)">
        Almacenamiento usado: ~${used.toFixed(0)} KB / ~5,000 KB disponibles en localStorage
      </div>`;
  },

  save() {
    const cfg = {
      nombreNegocio:      document.getElementById('cfg-nombre')?.value.trim() || 'ImportApp',
      porcentajeDefault:  parseFloat(document.getElementById('cfg-pct')?.value)    || 40,
      tarifaCourier:      parseFloat(document.getElementById('cfg-tarifa')?.value) || 8,
      pesoUnidad:         document.getElementById('cfg-peso-unit')?.value          || 'lbs',
      notas:              document.getElementById('cfg-notas')?.value.trim()  || '',
      logo:               window._logoActual || null,
      catalogColor:       document.getElementById('cfg-cat-color')?.value          || '#ec4899'
    };
    Storage.saveConfig(cfg);
    App.reloadConfig();
    App.toast('Configuración guardada', 'success');
    this.render();
  },

  importar(inp) {
    const file = inp.files[0];
    if (!file) return;
    App.confirm('¿Importar backup JSON? Los datos actuales serán reemplazados.', async () => {
      try {
        await Storage.importarJSON(file);
        App.toast('Backup JSON importado correctamente', 'success');
        App.reloadConfig();
        this.render();
      } catch {
        App.toast('Error al importar. Verifica el archivo.', 'error');
      }
    });
    inp.value = '';
  },

  importarExcel(inp) {
    const file = inp.files[0];
    if (!file) return;
    App.confirm('¿Restaurar desde backup Excel? Los datos actuales serán reemplazados. Las fotos de productos no se restaurarán.', async () => {
      try {
        await Storage.importarExcel(file);
        App.toast('Backup Excel importado correctamente', 'success');
        App.reloadConfig();
        this.render();
      } catch {
        App.toast('Error al importar. Verifica que sea un backup válido de ImportApp.', 'error');
      }
    });
    inp.value = '';
  },

  async _seleccionarCarpeta() {
    const nombre = await Storage.selectFolder();
    if (nombre) {
      App.toast(`Carpeta "${nombre}" vinculada. Los datos se guardarán ahí.`, 'success');
      App.updateSyncBtn();
      this.render();
    }
  },

  async _desconectarCarpeta() {
    App.confirm('¿Desconectar la carpeta? Los datos seguirán en localStorage pero no se guardarán en archivos.', async () => {
      await Storage.disconnectFolder();
      App.toast('Carpeta desconectada. Usando localStorage.', 'info');
      App.updateSyncBtn();
      this.render();
    });
  },

  borrarModulo(modulo) {
    const labels = { ventas:'ventas y abonos', productos:'productos' };
    App.confirm(`¿Eliminar todos los ${labels[modulo]||modulo}? Esta acción no se puede deshacer.`, () => {
      if (modulo === 'ventas') {
        Storage._set(Storage.K.VENTAS, []);
        Storage._set(Storage.K.ABONOS, []);
      } else if (modulo === 'productos') {
        Storage._set(Storage.K.PRODUCTOS, []);
      }
      App.toast(`${labels[modulo]||modulo} eliminados`, 'success');
      this.render();
    });
  },

  borrarTodo() {
    App.confirm('⚠️ Se eliminarán TODOS los datos: productos, importaciones, clientes, ventas, abonos y configuración. ¿Continuar?', () => {
      Object.values(Storage.K).forEach(k => localStorage.removeItem(k));
      App.toast('Datos eliminados', 'success');
      App.navigate('inventario');
    });
  },

  // ── GitHub ──────────────────────────────────────────────────────────────────
  async _testGitHub() {
    const owner = document.getElementById('cfg-gh-owner')?.value.trim();
    const repo  = document.getElementById('cfg-gh-repo')?.value.trim();
    const token = document.getElementById('cfg-gh-token')?.value.trim();
    if (!owner || !repo || !token) {
      App.toast('Completa usuario, repositorio y token antes de probar', 'warning');
      return;
    }
    try {
      const info = await GitHub.testConnection(owner, repo, token);
      App.toast(`✅ Conectado a ${info.name} (${info.private ? 'privado' : 'público'})`, 'success');
    } catch(e) {
      App.toast(`Error: ${e.message}`, 'error');
    }
  },

  _saveGitHub() {
    const owner  = document.getElementById('cfg-gh-owner')?.value.trim();
    const repo   = document.getElementById('cfg-gh-repo')?.value.trim();
    const branch = document.getElementById('cfg-gh-branch')?.value.trim() || 'main';
    const token  = document.getElementById('cfg-gh-token')?.value.trim();
    if (!owner || !repo || !token) {
      App.toast('Completa usuario, repositorio y token', 'warning');
      return;
    }
    GitHub.saveConfig({ owner, repo, branch, token });
    App.toast('Configuración GitHub guardada', 'success');
    App.updateSyncBtn();
    this.render();
  },

  _desconectarGitHub() {
    App.confirm('¿Desconectar GitHub? Los datos en el repositorio no se borran.', () => {
      GitHub.saveConfig({});
      App.toast('GitHub desconectado', 'info');
      App.updateSyncBtn();
      this.render();
    });
  },

  async _pushGitHub() {
    App.confirm('¿Subir todos los datos a GitHub? Sobreescribirá los archivos del repositorio.', async () => {
      App.toast('Subiendo datos a GitHub...', 'info');
      try {
        await GitHub.syncAll();
        App.toast('Datos subidos a GitHub correctamente ✅', 'success');
      } catch(e) {
        App.toast('Error al subir: ' + e.message, 'error');
      }
    });
  },

  async _pullGitHub() {
    App.confirm('¿Bajar datos de GitHub? Los datos locales serán reemplazados (las imágenes se conservan).', async () => {
      App.toast('Descargando datos de GitHub...', 'info');
      try {
        await GitHub.pullAll();
        App.toast('Datos descargados de GitHub correctamente ✅', 'success');
        App.reloadConfig();
        this.render();
      } catch(e) {
        App.toast('Error al bajar: ' + e.message, 'error');
      }
    });
  }
};
