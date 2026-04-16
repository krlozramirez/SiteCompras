/**
 * build.js — genera importapp_bundle.html con todo inline (CSS + JS)
 * Uso: node build.js
 */
const fs   = require('fs');
const path = require('path');
const root = __dirname;

const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const css = read('css/styles.css');
const scripts = [
  'js/storage.js',
  'js/inventario.js',
  'js/importaciones.js',
  'js/clientes.js',
  'js/ventas.js',
  'js/cartera.js',
  'js/catalogo.js',
  'js/reportes.js',
  'js/config.js',
  'js/app.js',
].map(f => read(f)).join('\n\n');

// Agrega meta viewport para móvil y mejoras responsive
const extraMobileCss = `
/* ── Mobile extra ── */
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .page-title { font-size: 18px; }
  .btn { padding: 7px 12px; font-size: 12px; }
  .modal { border-radius: 12px 12px 0 0; }
  .modal-overlay { align-items: flex-end; padding: 0; }
  table { font-size: 12px; }
  thead th, tbody td { padding: 8px 10px; }
}
`;

const bundle = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="ImportApp">
  <title>ImportApp</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
  <style>
${css}
${extraMobileCss}
  </style>
</head>
<body>
<div id="app">
  <aside id="sidebar">
    <div class="sidebar-header">
      <div id="sidebar-logo-wrap" style="display:none"><img id="sidebar-logo" src="" alt="" style="height:36px;border-radius:6px;margin-bottom:6px"></div>
      <h2 id="sidebar-title">ImportApp</h2>
    </div>
    <nav>
      <a href="#inventario"    class="nav-link active" data-view="inventario"><span class="nav-icon">📦</span><span>Inventario</span></a>
      <a href="#importaciones" class="nav-link" data-view="importaciones"><span class="nav-icon">📦</span><span>Pedidos Amazon</span></a>
      <a href="#clientes"      class="nav-link" data-view="clientes"><span class="nav-icon">👥</span><span>Clientes</span></a>
      <a href="#ventas"        class="nav-link" data-view="ventas"><span class="nav-icon">🛒</span><span>Pedidos Clientes</span></a>
      <a href="#cartera"       class="nav-link" data-view="cartera"><span class="nav-icon">💰</span><span>Cartera</span></a>
      <a href="#catalogo"      class="nav-link" data-view="catalogo"><span class="nav-icon">📄</span><span>Catálogo PDF</span></a>
      <a href="#reportes"      class="nav-link" data-view="reportes"><span class="nav-icon">📊</span><span>Reportes</span></a>
      <a href="#config"        class="nav-link" data-view="config"><span class="nav-icon">⚙️</span><span>Configuración</span></a>
    </nav>
    <div id="sync-panel">
      <button id="sync-btn" class="sync-btn sync-inactive" onclick="App.syncData()">
        <span class="sync-icon">💾</span>
        <span class="sync-label">Sin carpeta</span>
      </button>
      <div id="sync-status" class="sync-status">Configurar en ⚙️</div>
    </div>
  </aside>

  <main id="main-content">
    <div id="view-container"></div>
  </main>
</div>

<div id="modal-overlay" class="modal-overlay" style="display:none">
  <div id="modal" class="modal">
    <div class="modal-header">
      <h3 id="modal-title"></h3>
      <button class="modal-close" onclick="App.closeModal()">✕</button>
    </div>
    <div id="modal-body" class="modal-body"></div>
  </div>
</div>

<div id="toast-container"></div>

<script>
${scripts}
</script>
</body>
</html>`;

const out = path.join(root, 'importapp_bundle.html');
fs.writeFileSync(out, bundle, 'utf8');

const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`✅ Bundle generado: importapp_bundle.html (${kb} KB)`);
console.log('   Copia ese archivo al celular — funciona solo, sin carpetas adicionales.');
console.log('   Nota: los gráficos y exportar PDF/Excel requieren conexión a internet (CDN).');
