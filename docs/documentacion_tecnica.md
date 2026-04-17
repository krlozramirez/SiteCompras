# Documentación Técnica — ImportApp

## Tabla de contenidos

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Arquitectura de persistencia](#4-arquitectura-de-persistencia)
5. [Modelos de datos](#5-modelos-de-datos)
6. [Flujo completo del negocio](#6-flujo-completo-del-negocio)
7. [Fórmula de distribución de costos](#7-fórmula-de-distribución-de-costos)
8. [Módulos JavaScript](#8-módulos-javascript)
9. [Importación y exportación de datos](#9-importación-y-exportación-de-datos)
10. [Funcionalidades auxiliares](#10-funcionalidades-auxiliares)
11. [Sincronización GitHub](#11-sincronización-github)
12. [Mejoras futuras sugeridas](#12-mejoras-futuras-sugeridas)

---

## 1. Descripción general

ImportApp es una **SPA (Single Page Application) portátil** desarrollada con HTML/CSS/JS vanilla, sin dependencia de servidor backend. Está diseñada para gestionar integralmente un negocio de importación y reventa: desde el seguimiento de pedidos a Amazon, la distribución proporcional de costos de courier e impuestos, hasta la venta al cliente final con cartera y seguimiento de cobros.

Al ser completamente autocontenida en archivos estáticos, puede ejecutarse directamente desde el sistema de archivos local (`file://`) en cualquier navegador moderno, o servirse desde cualquier servidor HTTP estático. No requiere instalación, base de datos externa ni conexión a internet (salvo para cargar librerías CDN la primera vez, si no están en caché).

---

## 2. Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | — | Estructura de la SPA |
| CSS3 | — | Estilos y layout |
| JavaScript | ES6+ | Lógica de negocio (módulos, clases, async/await) |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Gráficos del dashboard de reportes |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | Generación de catálogo PDF |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.8.2 | Tablas en PDF (catálogo) |
| [SheetJS (xlsx)](https://sheetjs.com/) | última | Exportación e importación de archivos `.xlsx` |
| File System Access API | — | Escritura directa de archivos JSON en disco (Chrome/Edge 86+) |
| IndexedDB | — | Persistencia del `FileSystemDirectoryHandle` entre sesiones |
| localStorage | — | Respaldo automático de todos los datos en el navegador |
| GitHub REST API v3 | — | Sincronización en la nube: lectura y escritura de archivos JSON en un repositorio GitHub |

---

## 3. Estructura de archivos

```
importaciones-app/
├── index.html               — Punto de entrada (desarrollo local con servidor HTTP)
├── importapp_bundle.html    — Versión bundle auto-contenida para producción/GitHub Pages
├── build.js                 — Script Node.js que genera el bundle
├── css/
│   └── styles.css           — Todos los estilos (layout, módulos, print, responsive)
└── js/
    ├── storage.js           — Capa de datos: CRUD genérico, File System API, backup
    ├── github.js            — Sincronización con GitHub API (pull/push/auto-sync)
    ├── app.js               — Router hash, bootstrap, modal, toast, confirm dialog
    ├── inventario.js        — Gestión de productos y tracking individual de estado
    ├── importaciones.js     — Pedidos Amazon (crear, editar, recibir)
    ├── clientes.js          — Clientes y etiqueta de envío imprimible
    ├── ventas.js            — Pedidos de clientes (carrito, confirmación, historial)
    ├── cartera.js           — Gestión de cartera y exportación Excel filtrada
    ├── catalogo.js          — Generación de catálogo PDF con jsPDF
    ├── reportes.js          — Dashboard con 4 gráficos Chart.js y estadísticas
    └── config.js            — Configuración del negocio, GitHub y gestión de backups
```

### Responsabilidades por archivo

| Archivo | Responsabilidad principal |
|---|---|
| `index.html` | Shell de la SPA para desarrollo local (requiere servidor HTTP) |
| `importapp_bundle.html` | Versión auto-contenida para producción; generada por `build.js` |
| `styles.css` | Estilos globales, variables CSS, layout de tarjetas, formularios, `@media print` |
| `storage.js` | Única fuente de verdad para persistencia; expone funciones CRUD usadas por todos los módulos |
| `github.js` | Cliente GitHub API: pull al arrancar, auto-sync tras cambios, push/pull manual |
| `app.js` | Inicialización, routing por hash, auto-pull GitHub al arrancar, UI utilitaria (modal, toast) |
| `inventario.js` | CRUD de productos, compresión de fotos, cambio manual de `trackingStatus` |
| `importaciones.js` | CRUD de pedidos Amazon, selección de productos, cálculo de pesos, `recibirImportacion()` |
| `clientes.js` | CRUD de clientes, generación de etiqueta de envío en ventana emergente |
| `ventas.js` | Carrito de compra, creación de pedidos cliente, descuento de stock |
| `cartera.js` | Lista de pedidos con saldo pendiente, registro de abonos, exportación filtrada |
| `catalogo.js` | Renderiza grilla de productos en PDF con jsPDF + autotable |
| `reportes.js` | Calcula métricas y renderiza gráficos con Chart.js |
| `config.js` | Lee/escribe configuración global y GitHub, exporta/importa backups JSON y Excel |

---

## 4. Arquitectura de persistencia

La aplicación implementa un patrón **write-through cache** con tres capas de almacenamiento ordenadas por velocidad y portabilidad:

```
┌─────────────────────────────────────────────────────────┐
│                   Memoria RAM (_cache)                  │
│          Objeto JS en memoria — acceso inmediato        │
└────────────────────┬────────────────────────────────────┘
                     │ write-through (sincrónico)
┌────────────────────▼────────────────────────────────────┐
│                    localStorage                         │
│      Respaldo automático siempre activo (todas las      │
│      entidades serializadas como JSON string)           │
└────────────────────┬────────────────────────────────────┘
                     │ write-through (asincrónico, opcional)
┌────────────────────▼────────────────────────────────────┐
│          Archivos JSON en disco (File System API)       │
│   Requiere Chrome/Edge 86+ y permiso explícito usuario  │
│   El FileSystemDirectoryHandle se persiste en IndexedDB │
└────────────────────┬────────────────────────────────────┘
                     │ auto-sync debounced 2.5s (opcional)
┌────────────────────▼────────────────────────────────────┐
│         Repositorio GitHub (GitHub REST API v3)         │
│   Archivos JSON en un repo privado — accesible desde    │
│   cualquier dispositivo con internet. Las imágenes NO   │
│   se sincronizan (tamaño). Auto-pull al arrancar la app │
└─────────────────────────────────────────────────────────┘
```

### Claves de localStorage

| Clave | Contenido |
|---|---|
| `imp_productos` | Array JSON de todos los productos |
| `imp_importaciones` | Array JSON de todos los pedidos Amazon |
| `imp_clientes` | Array JSON de todos los clientes |
| `imp_ventas` | Array JSON de todos los pedidos de clientes |
| `imp_abonos` | Array JSON de todos los abonos registrados |
| `imp_config` | Objeto JSON con la configuración del negocio |
| `imp_github_cfg` | Objeto JSON con la configuración de GitHub (`owner`, `repo`, `branch`, `token`) |

### File System Access API

Cuando el usuario vincula una carpeta del sistema de archivos (desde `config.js`), cada escritura también persiste un archivo `.json` por entidad en esa carpeta. El `FileSystemDirectoryHandle` se guarda en IndexedDB para recuperarlo automáticamente en la próxima sesión sin que el usuario tenga que volver a seleccionar la carpeta (el navegador puede pedir confirmación de permiso al reabrir).

Esta capa es completamente **opcional**: si el navegador no soporta la API o el usuario no vincula carpeta, la aplicación funciona con normalidad usando solo localStorage.

### GitHub API (4ª capa — sincronización remota)

Cuando el usuario configura un repositorio GitHub en `Configuración → GitHub`, se activa una cuarta capa de persistencia:

- **Al arrancar** (`App.init`): se ejecuta `GitHub.pullAll()` antes de renderizar cualquier vista. Esto garantiza que el dispositivo siempre parte con la data más reciente del repositorio.
- **Tras cada modificación**: `Storage._set()`, `saveProducto()`, `deleteProducto()` y `saveConfig()` invocan `GitHub.autoSync()`, que programa un sync con debounce de 2.5 segundos. Esto agrupa ediciones rápidas en una sola llamada a la API.
- **Prevención de loop**: durante `pullAll()` se activa el flag `GitHub._suppress = true`, evitando que los `_set()` internos del pull disparen otro sync.
- **Imágenes**: las fotos de productos **no se sincronizan** con GitHub (demasiado grandes). Se almacenan `[imagen]` como placeholder en el repositorio y se restauran desde datos locales al hacer pull.
- **Configuración GitHub**: el objeto `imp_github_cfg` (owner, repo, branch, token) se guarda en localStorage Y se escribe como `imp_github_cfg.json` en la carpeta local (si está vinculada), permitiendo que otro dispositivo lo cargue automáticamente al apuntar a la misma carpeta.

---

## 5. Modelos de datos

### 5.1 Producto

```json
{
  "id": "string (UUID)",
  "nombre": "string",
  "descripcion": "string",
  "categoria": "string",
  "costoAmazon": "number (USD por unidad)",
  "peso": "number (libras por unidad)",
  "unidadesCompradas": "number (entero)",
  "codigoImportacion": "string (número de orden Amazon)",
  "porcentajeGanancia": "number (%, ej: 30)",
  "precioVenta": "number (USD, calculado o manual)",
  "costoCourier": "number (calculado — courier+envío+impuestos proporcional por unidad)",
  "inversionTotal": "number (costoAmazon + costoCourier, por unidad)",
  "stock": "number (unidades disponibles)",
  "trackingStatus": "enum: pedido | enviado | en aduana | en bodega | recibido",
  "estado": "enum: pendiente | disponible | agotado",
  "importacionId": "string (ID del pedido Amazon al que pertenece, nullable)",
  "foto": "string (base64 JPEG comprimida, nullable)",
  "fechaIngreso": "string (ISO 8601)"
}
```

### 5.2 Pedido Amazon (Importación)

```json
{
  "id": "string (UUID)",
  "nombre": "string (nombre descriptivo del pedido)",
  "descripcion": "string",
  "estado": "enum: pedido | en transporte | entregado",
  "fechaOrden": "string (ISO 8601)",
  "fechaEntregado": "string (ISO 8601, nullable)",
  "notas": "string",
  "productos": [
    {
      "productoId": "string",
      "nombre": "string",
      "unidades": "number",
      "pesoUd": "number (lbs)",
      "pesoTotal": "number (lbs — unidades × pesoUd)",
      "costoAmzUd": "number (USD)"
    }
  ],
  "pesoTotal": "number (lbs — suma de pesoTotal de todos los productos)",
  "valorAmazon": "number (USD — suma de costoAmzUd × unidades)",
  "tarifaCourier": "number (USD/lb)",
  "valorCourier": "number (USD — pesoTotal × tarifaCourier)",
  "costoEnvio": "number (USD — flete adicional, nullable)",
  "impuestos": "number (USD — impuestos de aduana, nullable)"
}
```

### 5.3 Cliente

```json
{
  "id": "string (UUID)",
  "nombre": "string",
  "cedula": "string",
  "telefono": "string",
  "correo": "string",
  "direccion": "string",
  "redSocial": "string (usuario Instagram/WhatsApp, etc.)",
  "ciudad": "string",
  "notas": "string",
  "fechaRegistro": "string (ISO 8601)"
}
```

### 5.4 Pedido Cliente (Venta)

```json
{
  "id": "string (UUID)",
  "clienteId": "string",
  "clienteNombre": "string (desnormalizado para display rápido)",
  "fecha": "string (ISO 8601)",
  "items": [
    {
      "productoId": "string",
      "nombre": "string",
      "cantidad": "number",
      "precioUnitario": "number (USD)"
    }
  ],
  "total": "number (USD — suma de cantidad × precioUnitario)",
  "pagadoInicial": "number (USD — pago al momento de crear el pedido)",
  "notas": "string"
}
```

### 5.5 Abono

```json
{
  "id": "string (UUID)",
  "ventaId": "string (ID del pedido cliente)",
  "clienteId": "string",
  "monto": "number (USD)",
  "fecha": "string (ISO 8601)",
  "notas": "string"
}
```

### 5.6 Configuración del negocio

```json
{
  "nombreNegocio": "string",
  "porcentajeDefault": "number (% de ganancia predeterminado para nuevos productos)",
  "tarifaCourier": "number (USD/lb predeterminada para nuevos pedidos Amazon)",
  "pesoUnidad": "number (peso predeterminado en lbs para nuevos productos)",
  "notas": "string",
  "logo": "string (base64 JPEG, nullable — usado en PDF y cabeceras)"
}
```

---

## 6. Flujo completo del negocio

El flujo describe el ciclo de vida completo de la mercancía, desde la compra en Amazon hasta el cobro al cliente final.

### Paso 1 — Registrar productos en Inventario

El usuario crea cada producto con su `costoAmazon`, `peso` (lbs/ud), `unidadesCompradas`, `porcentajeGanancia` y opcionalmente una foto. Al crear, el producto queda en estado `pendiente` y `trackingStatus: pedido`. El usuario puede actualizar manualmente el `trackingStatus` a medida que avanza el envío:

```
pedido → enviado → en aduana → en bodega → recibido
```

### Paso 2 — Crear Pedido Amazon

El usuario crea un pedido Amazon, selecciona explícitamente los productos que forman parte de ese envío, y define:

- `tarifaCourier` (USD/lb)
- `costoEnvio` (flete adicional, USD)
- `impuestos` (aduana, USD)

La aplicación calcula automáticamente:

- `pesoTotal` del pedido (suma de `peso × unidades` por producto)
- `valorCourier` = `pesoTotal × tarifaCourier`
- `valorAmazon` = suma de `costoAmzUd × unidades` por producto

### Paso 3 — Recibir importación (`recibirImportacion`)

Al marcar el pedido Amazon como `entregado`, la función `recibirImportacion()` ejecuta la distribución de costos extras (ver sección 7) y para cada producto actualiza:

- `costoCourier` (costo extra proporcional por unidad)
- `inversionTotal` (costoAmazon + costoCourier)
- `precioVenta` (inversionTotal × (1 + porcentajeGanancia / 100))
- `stock` = `unidadesCompradas`
- `estado` = `disponible`
- `trackingStatus` = `recibido`

### Paso 4 — Crear Pedido Cliente

El usuario abre el módulo de Ventas, selecciona un cliente, agrega productos al carrito (solo productos con `estado: disponible` y `stock > 0`), indica la cantidad y el precio unitario (prellenado con `precioVenta`). Al confirmar:

- Se descuenta el `stock` de cada producto.
- Si el stock llega a 0, el producto pasa a `estado: agotado`.
- Se registra el `pagadoInicial`.
- Si `pagadoInicial < total`, el pedido queda con saldo pendiente en Cartera.

### Paso 5 — Gestión de cartera

En el módulo de Cartera el usuario ve todos los pedidos con saldo pendiente. Puede registrar abonos sucesivos hasta saldar el pedido. Cada abono se almacena como entidad independiente (`imp_abonos`) para mantener historial completo.

**Saldo pendiente** de un pedido = `total - pagadoInicial - Σ abonos`

---

## 7. Fórmula de distribución de costos

Cuando se recibe una importación, los costos extras (courier, envío, impuestos) se distribuyen proporcionalmente al peso de cada producto dentro del pedido:

```
totalExtra = valorCourier + costoEnvio + impuestos

propPeso[i]    = pesoTotalProducto[i] / pesoTotalPedido

costoUnitario[i] = (propPeso[i] × totalExtra) / unidades[i]

inversionTotal[i] = costoAmazon[i] + costoUnitario[i]

precioVenta[i] = inversionTotal[i] × (1 + porcentajeGanancia[i] / 100)
```

Donde:
- `pesoTotalProducto[i]` = `peso[i] × unidades[i]` (peso total del lote del producto i)
- `pesoTotalPedido` = suma de `pesoTotalProducto[i]` para todos los productos del pedido
- `unidades[i]` = `unidadesCompradas` del producto i
- `costoAmazon[i]` = costo por unidad en Amazon del producto i

Esta distribución garantiza que productos más pesados absorban proporcionalmente más costo de courier e impuestos.

---

## 8. Módulos JavaScript

### 8.1 `storage.js` — Capa de datos

Centraliza toda la lógica de lectura/escritura. Los demás módulos nunca acceden directamente a localStorage ni a IndexedDB; siempre invocan funciones de este módulo.

Funciones principales:

| Función | Descripción |
|---|---|
| `getData(key)` | Lee de `_cache` (RAM); si no existe, carga desde localStorage |
| `saveData(key, data)` | Escribe en `_cache`, `localStorage` y, si está disponible, en el archivo JSON en disco |
| `initFileSystem(dirHandle)` | Vincula el `FileSystemDirectoryHandle` y lo persiste en IndexedDB |
| `getFileSystemHandle()` | Recupera el `FileSystemDirectoryHandle` desde IndexedDB |
| `exportBackupJSON()` | Serializa todas las entidades (incluidas fotos base64) en un único JSON descargable |
| `importBackupJSON(file)` | Restaura todas las entidades desde un archivo JSON de backup |
| `exportBackupExcel()` | Exporta todas las entidades (sin fotos) en un archivo `.xlsx` con una hoja por entidad |
| `importBackupExcel(file)` | Importa entidades desde un archivo `.xlsx` |

### 8.2 `github.js` — Sincronización GitHub

Encapsula toda la comunicación con la GitHub Contents API. Cargado antes que los módulos de negocio para que esté disponible cuando `Storage` llama a `autoSync()`.

| Función | Descripción |
|---|---|
| `isConfigured()` | Devuelve `true` si hay `owner`, `repo`, `branch` y `token` guardados |
| `testConnection(owner, repo, token)` | Verifica credenciales sin guardarlas; devuelve `{name, private}` |
| `syncAll()` | Sube los 6 archivos JSON al repositorio (productos sin foto, demás datos completos) |
| `pullAll()` | Descarga los 6 archivos JSON y los carga en `Storage`; restaura imágenes locales por ID |
| `autoSync()` | Cancela y reprograma un timer de 2.5s; al vencer llama `_doAutoSync()` |
| `_doAutoSync()` | Ejecuta `syncAll()` actualizando el botón sidebar; usa `_syncing` para serializar llamadas concurrentes |
| `_getSha(path)` | Obtiene el SHA actual de un archivo (requerido por la API para updates) |
| `_encode(obj)` / `_decode(b64)` | Conversión JSON ↔ base64 con soporte UTF-8 completo (acentos, ñ, etc.) |

**Flags de estado:**

| Flag | Propósito |
|---|---|
| `_syncing` | Evita ejecutar dos `syncAll()` concurrentes; el segundo se reprograma |
| `_suppress` | Activo durante `pullAll()` para que los `_set()` internos no disparen `autoSync()` |

### 8.3 `app.js` — Router y UI global

Implementa el router basado en el hash de la URL (`window.location.hash`). Al cambiar el hash, el router oculta todas las secciones y muestra la correspondiente, luego llama a la función de inicialización del módulo activo.

**Secuencia de arranque (`init`):**

1. Registra listeners de navegación
2. Muestra splash `"Cargando datos..."`
3. `await Storage.initStorage()` — carga datos desde carpeta local (si existe)
4. Si `GitHub.isConfigured()` → splash `"Sincronizando con GitHub..."` → `await GitHub.pullAll()`; si falla (sin internet) muestra toast warning y continúa con datos locales
5. `_applyConfig()` — aplica nombre y logo del negocio
6. `updateSyncBtn()` — actualiza el estado del botón sidebar
7. Navega a la vista del hash actual o `inventario`

**Botón Sincronizar (sidebar):**

Al presionar el botón, `syncData()` sincroniza con todas las capas activas:
- Si hay carpeta → `Storage.syncAll()` (escribe archivos locales)
- Si hay GitHub configurado → `GitHub.syncAll()` (sube al repo)
- Si ninguno está configurado → redirige a Configuración

El label del botón muestra el destino activo: `📁 MiCarpeta · 🐙 usuario/repo`.

Rutas soportadas:

| Hash | Módulo cargado |
|---|---|
| `#inventario` | `inventario.js` |
| `#importaciones` | `importaciones.js` |
| `#clientes` | `clientes.js` |
| `#ventas` | `ventas.js` |
| `#cartera` | `cartera.js` |
| `#catalogo` | `catalogo.js` |
| `#reportes` | `reportes.js` |
| `#config` | `config.js` |

Utilidades globales expuestas por `app.js`:

- **`showModal(title, bodyHTML, onConfirm)`**: Muestra un modal reutilizable con contenido HTML inyectado.
- **`showToast(message, type)`**: Notificación flotante (éxito, error, info) con desvanecimiento automático.
- **`showConfirm(message, onConfirm)`**: Diálogo de confirmación antes de acciones destructivas.

### 8.4 `inventario.js`

Gestiona el ciclo de vida de los productos:

- Listado con filtros por categoría, estado y `trackingStatus`.
- Formulario de creación/edición con compresión automática de foto (ver sección 10).
- Cambio manual de `trackingStatus` con botones de avance de estado.
- Cálculo en tiempo real de `precioVenta` al modificar `inversionTotal` o `porcentajeGanancia`.
- Carga masiva desde plantilla Excel (columnas detalladas en sección 9).

### 8.5 `importaciones.js`

Gestiona pedidos Amazon:

- Formulario de creación con selector múltiple de productos existentes.
- Al seleccionar un producto, recupera su `peso` y `costoAmazon` para calcular `pesoTotal` y `valorAmazon` en tiempo real.
- Al cambiar `tarifaCourier`, recalcula `valorCourier` automáticamente.
- Botón "Marcar como entregado" invoca `recibirImportacion()` y muestra resumen de costos distribuidos.

### 8.6 `clientes.js`

Gestiona la base de clientes:

- CRUD completo con validación de campos requeridos.
- Botón "Etiqueta de envío" abre una ventana emergente con HTML formateado para impresión (`@media print` en `styles.css`).
- Carga masiva desde plantilla Excel.

### 8.7 `ventas.js`

Gestiona pedidos de clientes:

- Selector de cliente con búsqueda en tiempo real.
- Carrito: agrega productos disponibles, controla que la cantidad no exceda el stock.
- Campo de pago inicial; si es menor al total, se crea registro en cartera automáticamente.
- Historial de pedidos con detalle expandible de ítems.

### 8.8 `cartera.js`

Gestiona el crédito y cobranza:

- Lista de pedidos con saldo pendiente, ordenados por fecha.
- Filtros: todos / en mora (fecha > X días) / por rango de fechas.
- Registro de abonos con fecha y notas.
- Barra de progreso de cobro por pedido.
- Estadísticas globales: total cartera, monto cobrado, porcentaje cobrado.
- Exportación Excel filtrada (solo los pedidos visibles en el filtro activo).

### 8.9 `catalogo.js`

Genera un catálogo PDF con jsPDF:

- Grilla de 3 columnas con foto (si existe), nombre, categoría y precio.
- Encabezado con logo del negocio (de `config.logo`) y nombre del negocio.
- Opción de incluir o excluir precios en el catálogo.
- Filtra solo productos con `estado: disponible`.

### 8.10 `reportes.js`

Dashboard con Chart.js (4 gráficos):

| Gráfico | Tipo | Datos |
|---|---|---|
| Ventas por mes | Barras (bar) | Total USD vendido agrupado por mes |
| Cobrado / Cartera / Inversión | Doughnut | Monto cobrado vs. pendiente vs. inversión total |
| Top productos | Barras horizontales | Productos más vendidos por unidades |
| Top clientes | Barras horizontales | Clientes con mayor volumen de compra en USD |

Estadísticas adicionales mostradas como tarjetas: total vendido, total cobrado, total en cartera, margen bruto estimado.

### 8.11 `config.js`

Gestiona la configuración global, GitHub y los backups:

- Formulario de configuración: nombre del negocio, porcentaje de ganancia predeterminado, tarifa courier predeterminada, peso predeterminado, logo (base64).
- Vinculación de carpeta del sistema de archivos (File System Access API).
- **Sección GitHub**: campos para `owner`, `repo`, `branch` y `token`; botones Probar conexión, Guardar, Desconectar, Subir a GitHub y Bajar de GitHub.
- Exportar backup JSON completo (incluye fotos).
- Importar backup JSON (restaura todo).
- Exportar backup Excel (sin fotos, todas las hojas).
- Importar backup Excel.
- Botón de limpieza total de datos (con confirmación).

---

## 9. Importación y exportación de datos

### Formatos soportados

| Tipo | Importar | Exportar | Notas |
|---|---|---|---|
| JSON backup completo | Sí | Sí | Incluye fotos en base64 |
| Excel `.xlsx` backup completo | Sí | Sí | Sin fotos; una hoja por entidad |
| CSV individual por módulo | No | Sí | Desde la vista de cada módulo |
| Plantilla Excel carga masiva | No | Sí | Columnas predefinidas para importar |
| Cartera filtrada | No | Sí | Solo los registros visibles (Excel) |

### Columnas para carga masiva de productos

El archivo Excel de carga masiva de productos debe contener las siguientes columnas (en cualquier orden, los encabezados son case-insensitive):

| Columna | Tipo | Requerido | Descripción |
|---|---|---|---|
| `nombre` | string | Sí | Nombre del producto |
| `descripcion` | string | No | Descripción detallada |
| `categoria` | string | No | Categoría para filtros |
| `costoAmazon` | number | Sí | Costo unitario en Amazon (USD) |
| `peso` | number | Sí | Peso en libras por unidad |
| `unidadesCompradas` | number | Sí | Cantidad comprada |
| `codigoImportacion` | string | No | Número de orden Amazon |
| `porcentajeGanancia` | number | No | % de ganancia (usa default de config si omitido) |
| `precioVenta` | number | No | Si se omite, se calcula automáticamente |
| `trackingStatus` | string | No | `pedido` si se omite |
| `estado` | string | No | `pendiente` si se omite |

### Columnas para carga masiva de clientes

| Columna | Tipo | Requerido | Descripción |
|---|---|---|---|
| `nombre` | string | Sí | Nombre completo |
| `telefono` | string | No | Número de teléfono o WhatsApp |
| `redSocial` | string | No | Usuario de red social |
| `ciudad` | string | No | Ciudad de entrega habitual |
| `notas` | string | No | Notas adicionales |

---

## 10. Funcionalidades auxiliares

### Compresión automática de fotos

Al subir una imagen para un producto, `inventario.js` la redimensiona y comprime automáticamente usando un elemento `<canvas>` antes de almacenarla como base64:

- Tamaño máximo: 500 px en el lado más largo (mantiene proporción).
- Formato de salida: JPEG con calidad `0.78`.
- Objetivo: minimizar el tamaño del payload en localStorage y en backups JSON.

### Etiqueta de envío imprimible

El módulo `clientes.js` genera una etiqueta de envío abriendo un popup HTML con los datos del cliente (nombre, dirección, ciudad, teléfono). La regla `@media print` en `styles.css` oculta todos los elementos excepto la etiqueta, permitiendo imprimirla directamente desde el diálogo del navegador.

### Catálogo PDF

El módulo `catalogo.js` usa jsPDF + autotable para generar un PDF estructurado:

- Encabezado: logo (si existe) + nombre del negocio.
- Cuerpo: grilla de 3 columnas, cada celda contiene la foto del producto (si existe), nombre, categoría y precio de venta (opcional).
- Solo incluye productos con `estado: disponible`.
- El PDF se descarga directamente como archivo `.pdf`.

### Gráficos Chart.js

Los cuatro gráficos del dashboard se destruyen y recrean en cada visita al módulo `#reportes` para evitar superposición de instancias al navegar entre vistas. Los datos se calculan en tiempo real desde `_cache`.

---

## 11. Sincronización GitHub

### Requisitos previos

1. Crear un **repositorio privado** en github.com (recomendado: `importapp-datos`).
2. Generar un **Personal Access Token (PAT)** clásico con scope `repo` en: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).

### Configuración en la app

En `Configuración → 🐙 GitHub`:

| Campo | Ejemplo | Descripción |
|---|---|---|
| Usuario | `miusuario` | Nombre de usuario u organización de GitHub |
| Repositorio | `importapp-datos` | Nombre del repo (sin URL) |
| Branch | `main` | Rama donde se guardarán los archivos |
| Token | `ghp_xxxx...` | PAT con scope `repo`; se guarda solo en localStorage |

Presionar **"Probar conexión"** antes de guardar para verificar credenciales.

### Archivos generados en el repositorio

| Archivo | Contenido |
|---|---|
| `imp_productos.json` | Productos (campo `foto` reemplazado por `[imagen]`) |
| `imp_importaciones.json` | Pedidos Amazon completos |
| `imp_clientes.json` | Clientes completos |
| `imp_ventas.json` | Ventas completas |
| `imp_abonos.json` | Abonos completos |
| `imp_config.json` | Configuración (campo `logo` reemplazado por `[imagen]`) |

### Flujo de sincronización automática

```
App abre
  └─ GitHub.pullAll() ──────────────────► repo GitHub
       └─ Descarga 6 archivos JSON
       └─ Restaura imágenes desde localStorage local
       └─ Carga datos en Storage._cache + localStorage

Usuario modifica dato (crear/editar/borrar)
  └─ Storage._set() / saveProducto() / saveConfig()
       └─ GitHub.autoSync() ─── debounce 2.5s ──► GitHub.syncAll()
                                                        └─ GET SHA actual de cada archivo
                                                        └─ PUT archivo actualizado
```

### Comportamiento ante fallo de red

- **Pull al arrancar falla**: se muestra toast de advertencia y la app continúa con datos locales del último sync.
- **Auto-sync falla**: el botón sidebar muestra `⚠️ Error sync` durante 3 segundos; no interrumpe al usuario.
- **Sync concurrente**: si ya hay un `syncAll()` en ejecución y llega otro pedido, se reprograma (nunca se ejecutan dos en paralelo).

### Compartir configuración entre dispositivos

El objeto `imp_github_cfg` se guarda también como archivo `imp_github_cfg.json` en la carpeta local (si está vinculada). Al apuntar otro dispositivo a la misma carpeta, la configuración de GitHub se carga automáticamente sin necesidad de reingresarla.

---

## 12. Mejoras futuras sugeridas

### Alta prioridad

1. **Comprobante/recibo imprimible del pedido cliente**
   Generar un PDF (jsPDF) o HTML imprimible con el detalle del pedido: cliente, ítems, total, saldo y datos del negocio. Idealmente compartible por WhatsApp (link a blob URL o descarga directa).

2. **Editar/cancelar pedido cliente con restauración de stock**
   Actualmente los pedidos no son editables. Al permitir edición o cancelación, se debe restablecer el stock de los productos involucrados y ajustar o eliminar los abonos asociados.

3. **Estado de entrega independiente del estado de pago**
   Agregar un campo `estadoEntrega` al modelo de venta con el ciclo: `preparando → listo → enviado → entregado`. Esto desacopla la logística del cobro.

### Media prioridad

4. **Stock mínimo por producto con alerta visual**
   Agregar campo `stockMinimo` al producto. Mostrar badge o highlight visual (rojo/amarillo) cuando `stock <= stockMinimo`. Incluir sección de alertas en el dashboard.

5. **Descuentos en pedido cliente**
   Soportar descuento por pedido (porcentaje o valor fijo). El modelo de venta debe incluir `descuento` y `totalConDescuento`. Recalcular en tiempo real en el carrito.

6. **Número de pedido secuencial automático**
   Generar un identificador legible del tipo `PC-0001`, `PC-0002` al crear cada pedido cliente. Guardarlo en el modelo como `numeroPedido`. El contador se persiste en `imp_config`.

### Baja prioridad

7. **Variantes de producto (tallas/colores)**
   Extender el modelo de producto con un array `variantes: [{nombre, stock}]`. Cada variante gestiona su propio stock pero comparte costo y precio del producto padre.

8. **Trazabilidad del producto**
   Para cada unidad vendida, registrar: en qué pedido Amazon llegó (`importacionId`), cuándo se recibió y en qué pedido cliente se vendió. Esto permite auditorías y análisis de rotación por lote.

9. **Búsqueda global entre módulos**
   Barra de búsqueda en la cabecera que consulte simultáneamente productos, clientes y pedidos. Resultados agrupados por tipo con link directo al registro.

10. **Múltiples fotos por producto**
    Cambiar el campo `foto` (string base64) por un array `fotos: [string]`. Implementar galería con thumbnails en la vista de detalle y selección de foto principal para el catálogo PDF.

---

*Documentación actualizada el 2026-04-16. Incluye sincronización GitHub (auto-pull al arrancar, auto-sync por cambio, multi-dispositivo).*
