/* =========================================================================
   Ascendia · Globo de oportunidades educativas
   HTML + CSS + JS puro · globe.gl (Three.js) por CDN
   ========================================================================= */

/* ---------------------------------------------------------------------------
   1. CARGA DE DATOS
   Hoy devuelve el array embebido. Para producción, reemplazar el cuerpo por:
     return fetch('/api/oportunidades').then(r => r.json());
   ...sin tocar el resto de la app.
--------------------------------------------------------------------------- */
async function cargarDatos() {
  const oportunidades = [
    {id:1, titulo:"Beca DAAD para Maestría en Ingeniería", tipo:"BECA", lat:52.51, lng:13.41, fechaApertura:"2026-05-01", fechaLimite:"2026-10-15", diasRestantes:128, modalidad:"PRESENCIAL", idioma:"Inglés"},
    {id:2, titulo:"Erasmus Mundus Joint Masters", tipo:"BECA", lat:48.85, lng:2.34, fechaApertura:"2026-04-15", fechaLimite:"2026-09-01", diasRestantes:84, modalidad:"PRESENCIAL", idioma:"Inglés"},
    {id:3, titulo:"Curso Online: Inteligencia Artificial (MIT)", tipo:"CURSO", lat:42.36, lng:-71.09, fechaApertura:"2026-06-01", fechaLimite:"2026-12-31", diasRestantes:205, modalidad:"VIRTUAL", idioma:"Inglés"},
    {id:5, titulo:"Pasantía en Investigación - University of Tokyo", tipo:"PASANTIA", lat:35.71, lng:139.76, fechaApertura:"2026-03-01", fechaLimite:"2026-07-01", diasRestantes:22, modalidad:"PRESENCIAL", idioma:"Inglés"},
    {id:6, titulo:"Voluntariado Educativo en Comunidades Rurales", tipo:"VOLUNTARIADO", lat:4.60, lng:-74.07, fechaApertura:"2026-06-01", fechaLimite:"2026-11-30", diasRestantes:174, modalidad:"PRESENCIAL", idioma:"Español"},
    {id:7, titulo:"Beca Fulbright para Doctorado en EE.UU.", tipo:"BECA", lat:42.36, lng:-71.09, fechaApertura:"2026-02-15", fechaLimite:"2026-06-30", diasRestantes:21, modalidad:"PRESENCIAL", idioma:"Inglés"}
  ];
  return oportunidades;
}

/* ---------------------------------------------------------------------------
   2. CONFIGURACIÓN DE MARCA
--------------------------------------------------------------------------- */
const TIPOS = {
  BECA:         { color:'#FDA818', label:'Beca' },
  CURSO:        { color:'#FF5630', label:'Curso' },
  PASANTIA:     { color:'#FF2D9C', label:'Pasantía' },
  VOLUNTARIADO: { color:'#59C84A', label:'Voluntariado' },
  INTERCAMBIO:  { color:'#9D4EFF', label:'Intercambio' }
};

const OCEAN_PRESETS = [
  { name:'Azul planeta', ocean:'#1a3f7a', land:'#0b2147' },
  { name:'Azul noche',   ocean:'#11305f', land:'#081a3c' },
  { name:'Profundo',     ocean:'#0c2a5c', land:'#06152f' },
  { name:'Turquesa',     ocean:'#17527e', land:'#0a2845' }
];

const URGENTE_DIAS = 45;          // umbral para anillo pulsante
const fmtFecha = (iso) => {
  const [y,m,d] = iso.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[(+m)-1]} ${y}`;
};
const urgencia = (dias) => Math.min(1, Math.max(0, (200 - dias) / 200)); // 0..1
const fmtCoord = (n) => Number(n).toFixed(6);
const fmtCoords = (lat, lng) => `${fmtCoord(lat)}°, ${fmtCoord(lng)}°`;
const googleMapsUrl = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${fmtCoord(lat)},${fmtCoord(lng)}`)}`;

/* ---------------------------------------------------------------------------
   3. ESTADO
--------------------------------------------------------------------------- */
let GLOBE, DATA = [];
let COUNTRY_LABELS = [];        // {lat,lng,name} por país
let CITY_PLACES = [];           // {lat,lng,name,rank} lugares poblados
let STATE_LINES = [];           // límites de estados/provincias (paths)
let STATE_LABELS = [];          // {lat,lng,name} nombres de estados/provincias
let COUNTY_LINES = [];          // límites de 2º nivel (condados/municipios)
let LAND_RINGS = [];            // anillos [lng,lat] para ajustar marcadores costeros
let bordersLevel = -1;          // nivel de límites activo (-1 ninguno)
let lastBordKey = '';           // gate de recálculo de límites
let lastCityKey = '';           // gate de recálculo de ciudades
let lastStateKey = '';          // gate de recálculo de estados
let lastAltLevel = '';          // gate de cilindros/etiquetas por nivel
let labelMode = '';             // '', 'country' o 'city'
const LABEL_SHOW_ALT = 1.65;    // bajo esta altitud aparecen los países
const STATE_ALT = 1.05;         // bajo esta altitud aparecen estados/provincias
const CITY_ALT = 0.62;          // bajo esta altitud aparecen ciudades/pueblos
const BASE_ALT = 0.15;          // altura base del cilindro
const dotEls = new Map();       // puntos brillosos por id
const uniEls = new Map();       // marcadores de universidades por uid
let UNI_DATA = [];              // universidades (QS 2026) embebidas
let uniVisible = true;          // mostrar / ocultar universidades
const activos = new Set(Object.keys(TIPOS));      // tipos visibles
const settings = {
  oceanIdx: 0,
  glow: 1.0,        // 0..2
  rotSpeed: 0.40,   // grados/frame aprox
  land: 0.5         // brillo continentes 0..1
};

/* ---------------------------------------------------------------------------
   4. INICIALIZACIÓN
--------------------------------------------------------------------------- */
async function init() {
  DATA = await cargarDatos();

  // universidades (QS 2026 + recomendadas) desde universidades.js
  UNI_DATA = (window.UNIVERSIDADES || []).map((u, i) => ({
    ...u, uid: 'u' + i, kind: 'uni', lat: +u.lat, lng: +u.lng,
    displayLat: +u.lat, displayLng: +u.lng
  })).filter(u => isFinite(u.lat) && isFinite(u.lng));

  GLOBE = Globe({
    rendererConfig: {
      preserveDrawingBuffer: false,
      antialias: false,
      powerPreference: 'high-performance'
    }
  })(document.getElementById('globeViz'))
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#00C7DD')
    .atmosphereAltitude(0.18)
    .pointsData([])
    .pointLat('lat').pointLng('lng')
    .pointColor(d => TIPOS[d.tipo].color)
    .pointAltitude(() => BASE_ALT)
    .pointRadius(() => 0.78)
    .pointResolution(10)
    .pointsMerge(false)
    .pointsTransitionDuration(0)
    .pointLabel(tooltipHTML)
    .onPointHover(onHover)
    .onPointClick(abrirDetalle)
    .ringsData([])
    .ringLat('lat').ringLng('lng')
    .ringAltitude(0.02) // por encima de las placas de los continentes
    .ringColor(d => (t => `rgba(${t},OP)`)) // placeholder, set below
    .ringMaxRadius(() => 4.6)
    .ringPropagationSpeed(1.6)
    .ringRepeatPeriod(() => 1100);

  // ring color con fade (función que recibe t 0..1)
  GLOBE.ringColor(d => {
    const c = hexToRgb(TIPOS[d.tipo].color);
    return t => `rgba(${c.r},${c.g},${c.b},${(1 - t) * 0.85})`;
  });

  // etiquetas: países al acercar, ciudades/pueblos al acercar más
  GLOBE
    .labelsData([])
    .labelLat('lat').labelLng('lng')
    .labelText('name')
    .labelSize(d => d.size || 0.5)
    .labelColor(d => d.color || 'rgba(233,241,253,0.92)')
    .labelResolution(2)
    .labelAltitude(d => d.alt != null ? d.alt : 0.015)
    .labelIncludeDot(false)
    .labelsTransitionDuration(0);
  GLOBE.onZoom(actualizarEtiquetas);

  // capa HTML: faros de oportunidades + marcadores de universidades
  GLOBE
    .htmlElementsData([])
    .htmlLat(markerLat).htmlLng(markerLng)
    .htmlAltitude(htmlAltAccessor)
    .htmlElement(crearHtmlEl);

  // límites administrativos internos (estados/provincias)
  GLOBE
    .pathsData([])
    .pathPoints(d => d.coords)
    .pathPointLat(p => p[0])
    .pathPointLng(p => p[1])
    .pathPointAlt(0.02)
    .pathColor(d => d.color)
    .pathStroke(d => d.stroke)
    .pathTransitionDuration(0)
    .pathResolution(3);

  // material del océano + atmósfera
  aplicarColorGlobo();
  aplicarGlow();

  // controles / rotación
  const c = GLOBE.controls();
  c.autoRotate = true;
  c.autoRotateSpeed = settings.rotSpeed;
  c.enableDamping = true;
  c.dampingFactor = 0.12;
  c.minDistance = 104;   // permite acercarse hasta nivel ciudad/pueblo
  c.maxDistance = 520;
  c.rotateSpeed = 0.7;
  c.zoomSpeed = 0.8;
  GLOBE.pointOfView({ lat: 18, lng: -30, altitude: 2.4 }, 0);

  // recalcular sólo cuando el usuario interactúa (no en cada frame de autorotación)
  let viewTimer = null;
  const programarVista = () => {
    if (viewTimer) return;
    viewTimer = setTimeout(() => {
      viewTimer = null;
      actualizarEtiquetas(GLOBE.pointOfView());
    }, 120);
  };
  c.addEventListener('change', programarVista);

  // continentes (GeoJSON) — no bloquea el render si falla
  cargarContinentes();
  cargarCiudades();
  cargarLimites();

  // estrellas titilantes de fondo
  initStars();

  // animación de los puntos brillosos (escala según zoom + oclusión)
  requestAnimationFrame(animarPuntos);

  // pausa de rotación al interactuar
  wireRotationPause();

  // pausar los bucles de animación cuando la pestaña no está visible (ahorro CPU/batería)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;            // los loops se auto-detienen al ocultarse
    _puntosLast = 0;
    if (puntosRAF == null) puntosRAF = requestAnimationFrame(animarPuntos);
    if (starsRAF == null && starsLoop) starsRAF = requestAnimationFrame(starsLoop);
  });

  // resize
  const onResize = () => GLOBE.width(window.innerWidth).height(window.innerHeight);
  window.addEventListener('resize', onResize);
  onResize();

  // cap del pixel-ratio del renderer: en pantallas retina (DPR 2–3) el canvas WebGL
  // se vuelve enorme y satura la GPU. Limitarlo a 1.5 es casi imperceptible y muy
  // más fluido. Se reaplica en resize porque globe.gl puede reajustarlo.
  const capDPR = () => {
    try {
      const r = GLOBE.renderer();
      const cap = window.innerWidth < 760 ? 1.15 : 1.35;
      if (r && r.setPixelRatio) r.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    } catch (e) {}
  };
  capDPR();
  window.addEventListener('resize', capDPR);

  // UI
  construirFiltros();
  construirSwatches();
  wireSettings();
  wireDetalle();
  wireUniversidades();
  refrescarPuntos();

  // ocultar loader
  setTimeout(() => document.getElementById('loader').classList.add('hide'), 650);
}

/* ---------------------------------------------------------------------------
   5. CONTINENTES (polígonos GeoJSON sobre esfera de color de marca)
--------------------------------------------------------------------------- */
function cargarContinentes() {
  const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
  fetch(url)
    .then(r => r.json())
    .then(geo => {
      const feats = (geo.features || []).filter(f => f.properties.ISO_A2 !== 'AQ'); // sin Antártida
      prepararAnillosTierra(feats);
      ajustarUniversidadesATierra();
      GLOBE
        .polygonsData(feats)
        .polygonCapColor(() => landCapColor())
        .polygonSideColor(() => 'rgba(0,32,84,0.55)')
        .polygonStrokeColor(() => 'rgba(0,199,221,0.32)')
        .polygonAltitude(0.012);

      // construir etiquetas (centroide de cada país)
      COUNTRY_LABELS = feats.map(f => {
        const c = centroidePais(f.geometry);
        const p = f.properties;
        return {
          lat: c.lat, lng: c.lng,
          name: p.ADMIN || p.NAME || p.name || '',
          size: 0.55, alt: 0.015,
          color: 'rgba(233,241,253,0.94)', kind: 'country'
        };
      }).filter(l => l.name);
      actualizarEtiquetas(GLOBE.pointOfView());
      actualizarMarcadores(GLOBE.pointOfView());
    })
    .catch(() => { /* esfera lisa de marca como fallback */ });
}

function markerLat(d) { return d && d.kind === 'uni' ? d.displayLat : d.lat; }
function markerLng(d) { return d && d.kind === 'uni' ? d.displayLng : d.lng; }

function prepararAnillosTierra(feats) {
  LAND_RINGS = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) if (ring && ring.length > 2) LAND_RINGS.push(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        for (const ring of poly) if (ring && ring.length > 2) LAND_RINGS.push(ring);
      }
    }
  }
}

function ajustarUniversidadesATierra() {
  if (!LAND_RINGS.length || !UNI_DATA.length) return;
  for (const u of UNI_DATA) {
    u.displayLat = u.lat;
    u.displayLng = u.lng;
    u.snappedToLand = false;
    if (puntoEnTierra(u.lng, u.lat)) continue;
    const snap = puntoTierraMasCercano(u.lng, u.lat);
    if (!snap || snap.dist > 6) continue;
    u.displayLat = snap.lat;
    u.displayLng = snap.lng;
    u.snappedToLand = true;
  }
}

function puntoEnTierra(lng, lat) {
  for (const ring of LAND_RINGS) {
    if (puntoEnAnillo(lng, lat, ring)) return true;
  }
  return false;
}

function puntoEnAnillo(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const crosses = (yi > lat) !== (yj > lat);
    if (crosses) {
      const x = ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
      if (lng < x) inside = !inside;
    }
  }
  return inside;
}

function puntoTierraMasCercano(lng, lat) {
  const cosLat = Math.max(0.08, Math.cos(lat * Math.PI / 180));
  let best = null;
  for (const ring of LAND_RINGS) {
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      const p = puntoMasCercanoSegmento(lng, lat, a[0], a[1], b[0], b[1], cosLat);
      if (!best || p.dist < best.dist) best = p;
    }
  }
  return best;
}

function puntoMasCercanoSegmento(px, py, ax, ay, bx, by, cosLat) {
  let dx = bx - ax;
  if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
  const dy = by - ay;
  const qx = px - ax;
  const qy = py - ay;
  const sx = dx * cosLat;
  const qxs = qx * cosLat;
  const len2 = sx * sx + dy * dy || 1e-12;
  let t = (qxs * sx + qy * dy) / len2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  let lng = ax + dx * t;
  if (lng > 180) lng -= 360; else if (lng < -180) lng += 360;
  const lat = ay + dy * t;
  const ddx = (px - lng) * cosLat;
  const ddy = py - lat;
  return { lng, lat, dist: Math.sqrt(ddx * ddx + ddy * ddy) };
}

/* ---------------------------------------------------------------------------
   5.b CIUDADES Y PUEBLOS (Natural Earth populated places)
--------------------------------------------------------------------------- */
function cargarCiudades() {
  const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
  fetch(url)
    .then(r => r.json())
    .then(geo => {
      CITY_PLACES = (geo.features || []).map(f => {
        const co = f.geometry && f.geometry.coordinates;
        if (!co) return null;
        const p = f.properties;
        const sr = (p.SCALERANK != null) ? p.SCALERANK : p.scalerank;
        const pop = (p.POP_MAX != null) ? p.POP_MAX : p.pop_max;
        const nm = p.NAME || p.name || p.NAMEASCII || p.nameascii || '';
        let rank = (sr != null) ? sr : rankDesdePob(pop);
        return { lat: co[1], lng: co[0], name: nm, rank, kind: 'city' };
      }).filter(c => c && c.name);
      if (labelMode === 'city') actualizarEtiquetas(GLOBE.pointOfView());
    })
    .catch(() => { /* sin ciudades: se mantienen los países */ });
}

function rankDesdePob(pop) {
  if (!pop) return 9;
  if (pop > 5e6) return 1;
  if (pop > 1e6) return 3;
  if (pop > 3e5) return 5;
  if (pop > 8e4) return 7;
  if (pop > 2e4) return 9;
  return 10;
}

/* ---------------------------------------------------------------------------
   5.c LÍMITES ADMINISTRATIVOS INTERNOS (estados/provincias y 2º nivel)
--------------------------------------------------------------------------- */
function geojsonALineas(geo) {
  const out = [];
  for (const f of (geo.features || [])) {
    const g = f.geometry;
    if (!g) continue;
    const push = (line) => {
      if (line.length < 2) return;
      // Simplificar con Douglas–Peucker: conserva esquinas reales y elimina
      // sólo puntos redundantes, así el borde sigue fiel a su trazo (sin zigzag).
      let src = line;
      if (src.length > 1600) {                 // pre-decimado de seguridad
        const st = Math.ceil(src.length / 1600);
        const tmp = [];
        for (let i = 0; i < src.length; i += st) tmp.push(src[i]);
        tmp.push(src[src.length - 1]);
        src = tmp;
      }
      const simp = rdpSimplify(src, 0.025);     // tolerancia ~2.5 km
      const pts = [];
      for (const c of simp) pts.push([c[1], c[0]]); // [lng,lat] -> [lat,lng]
      if (pts.length < 2) return;
      const mid = pts[pts.length >> 1];
      out.push({ coords: pts, clat: mid[0], clng: mid[1] });
    };
    if (g.type === 'LineString') push(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(push);
    else if (g.type === 'Polygon') g.coordinates.forEach(push);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(push));
  }
  return out;
}

/* Ramer–Douglas–Peucker sobre coords [lng,lat]; eps en grados. Iterativo (sin
   recursión) para no desbordar la pila en líneas largas. */
function rdpSimplify(points, eps) {
  const n = points.length;
  if (n < 3) return points.slice();
  const eps2 = eps * eps;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const ax = points[s][0], ay = points[s][1];
    const bx = points[e][0], by = points[e][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let dmax = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const px = points[i][0], py = points[i][1];
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const cx = ax + t * dx, cy = ay + t * dy;
      const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (idx !== -1 && dmax > eps2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function cargarLimites() {
  // estados / provincias (50m) — de aquí salen los bordes Y los nombres
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson')
    .then(r => r.json())
    .then(geo => {
      STATE_LINES = geojsonALineas(geo);
      STATE_LABELS = (geo.features || []).map(f => {
        if (!f.geometry) return null;
        const c = centroidePais(f.geometry);
        const p = f.properties || {};
        const nm = p.name || p.name_en || p.gn_name || p.woe_name || '';
        return { lat: c.lat, lng: c.lng, name: nm, kind: 'state' };
      }).filter(s => s && s.name && isFinite(s.lat) && isFinite(s.lng));
      if (bordersLevel >= 1) { lastBordKey = ''; aplicarLimites(GLOBE.pointOfView().altitude); }
      if (labelMode === 'state') { lastStateKey = ''; etiquetasEstados(GLOBE.pointOfView()); }
    })
    .catch(() => {});
}

/* las líneas que se renderizan dependen del zoom y de la zona visible */
const MAX_PATHS = 420;
function aplicarLimites(alt) {
  // nivel objetivo según altitud
  const lvl = (alt > LABEL_SHOW_ALT) ? -1 : 1;

  bordersLevel = lvl;
  if (lvl < 1) {
    if (GLOBE.pathsData().length) { GLOBE.pathsData([]); lastBordKey = ''; }
    return;
  }

  const pov = GLOBE.pointOfView();
  const cLat = pov.lat, cLng = pov.lng;
  const cMax = Math.cos(cLat * Math.PI / 180) || 0.01;
  const win = Math.max(6, alt * 55);

  // gate: si nivel/centro/zoom no cambiaron lo suficiente, no rehacer
  const key = lvl + '|' + cLat.toFixed(1) + '|' + cLng.toFixed(1) + '|' + win.toFixed(1);
  if (key === lastBordKey) return;
  lastBordKey = key;

  // intensidad crece al acercarse
  const t = Math.min(1, Math.max(0, (LABEL_SHOW_ALT - alt) / LABEL_SHOW_ALT));
  // tono alineado con el cian de marca y más fino: linework secundario discreto
  const stColor = `rgba(118,198,232,${(0.4 + t * 0.34).toFixed(2)})`;
  const stStroke = 0.5 + t * 0.65;

  const win2 = win * win;
  const paths = [];
  for (let i = 0; i < STATE_LINES.length && paths.length < MAX_PATHS; i++) {
    const l = STATE_LINES[i];
    let dLng = l.clng - cLng;
    if (dLng > 180) dLng -= 360; else if (dLng < -180) dLng += 360;
    dLng *= cMax;
    const dLat = l.clat - cLat;
    if (dLat * dLat + dLng * dLng < win2)
      paths.push({ coords: l.coords, color: stColor, stroke: stStroke });
  }
  GLOBE.pathsData(paths);

  // bordes de países más marcados al acercarse
  if (GLOBE.polygonsData() && GLOBE.polygonsData().length) {
    GLOBE.polygonStrokeColor(() => `rgba(0,199,221,${(0.35 + t * 0.45).toFixed(2)})`);
  }
}

/* etiquetas por niveles: nada · país · estado/provincia · ciudad */
function actualizarEtiquetas(pov) {
  if (!pov) return;
  const alt = pov.altitude;

  ajustarCilindros(alt);
  aplicarLimites(alt);
  actualizarMarcadores(pov);

  if (alt > LABEL_SHOW_ALT) {            // muy lejos: sin nombres
    if (labelMode !== '') { labelMode = ''; GLOBE.labelsData([]); }
    return;
  }
  if (alt > STATE_ALT) {                 // lejos-medio: nombres de país
    if (labelMode !== 'country') {
      labelMode = 'country'; lastStateKey = ''; lastCityKey = '';
      GLOBE.labelsData(COUNTRY_LABELS);
    }
    return;
  }
  if (alt > CITY_ALT) {                  // medio-cerca: estados / provincias
    if (labelMode !== 'state') { labelMode = 'state'; lastStateKey = ''; }
    etiquetasEstados(pov);
    return;
  }
  // cerca: ciudades y pueblos
  if (labelMode !== 'city') { labelMode = 'city'; lastCityKey = ''; }
  etiquetasCiudades(pov, alt);
}

/* estados / provincias más cercanos al centro de la vista */
function etiquetasEstados(pov) {
  if (!STATE_LABELS.length) { GLOBE.labelsData(COUNTRY_LABELS); return; }
  const cLat = pov.lat, cLng = pov.lng;
  const cMax = Math.cos(cLat * Math.PI / 180) || 0.01;
  const stateKey = cLat.toFixed(1) + '|' + cLng.toFixed(1);
  if (stateKey === lastStateKey) return;
  lastStateKey = stateKey;

  const cercanas = [];
  for (const s of STATE_LABELS) {
    const dLat = s.lat - cLat;
    let dLng = s.lng - cLng;
    if (dLng > 180) dLng -= 360; else if (dLng < -180) dLng += 360;
    s._dd = dLat * dLat + (dLng * cMax) * (dLng * cMax);
    cercanas.push(s);
  }
  cercanas.sort((a, b) => a._dd - b._dd);
  const top = cercanas.slice(0, 80).map(s => ({
    lat: s.lat, lng: s.lng, name: s.name,
    size: 0.34, alt: 0.014,
    color: 'rgba(186,222,244,0.92)', kind: 'state'
  }));
  GLOBE.labelsData(top);
}

/* ciudades y pueblos progresivos, priorizando el centro de la vista */
function etiquetasCiudades(pov, alt) {
  if (!CITY_PLACES.length) { return; }
  const t = Math.min(1, Math.max(0, (CITY_ALT - alt) / (CITY_ALT - 0.06)));
  const maxRank = Math.round(2 + t * 8);        // 2 (megaciudades) … 10 (pueblos)
  const cLat = pov.lat, cLng = pov.lng;
  const cMax = Math.cos(cLat * Math.PI / 180);

  // gate: evita rescanear las miles de ciudades si nada cambió lo suficiente
  const cityKey = maxRank + '|' + cLat.toFixed(1) + '|' + cLng.toFixed(1);
  if (cityKey === lastCityKey) return;
  lastCityKey = cityKey;

  const cercanas = [];
  for (const c of CITY_PLACES) {
    if (c.rank > maxRank) continue;
    const dLat = c.lat - cLat;
    let dLng = c.lng - cLng;
    if (dLng > 180) dLng -= 360; else if (dLng < -180) dLng += 360;
    c._dd = dLat * dLat + (dLng * cMax) * (dLng * cMax);
    cercanas.push(c);
  }
  cercanas.sort((a, b) => a._dd - b._dd);
  const top = cercanas.slice(0, 90).map(c => ({
    lat: c.lat, lng: c.lng, name: c.name,
    size: Math.max(0.10, 0.10 + (8 - c.rank) * 0.018),
    alt: 0.012,
    color: c.rank <= 3 ? 'rgba(236,244,255,0.95)' : 'rgba(150,210,235,0.92)',
    kind: 'city'
  }));
  GLOBE.labelsData(top);
}

/* centroide aproximado: anillo de mayor área (evita que territorios lo desplacen) */
function centroidePais(geom) {
  let rings = [];
  if (geom.type === 'Polygon') rings = geom.coordinates;
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => rings.push(...p));
  let best = rings[0], bestArea = -1;
  for (const r of rings) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const [x, y] of r) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    const area = (maxx - minx) * (maxy - miny);
    if (area > bestArea) { bestArea = area; best = r; }
  }
  let sx = 0, sy = 0;
  for (const [x, y] of best) { sx += x; sy += y; }
  return { lng: sx / best.length, lat: sy / best.length };
}

function landCapColor() {
  const p = OCEAN_PRESETS[settings.oceanIdx];
  // mezcla del color base de tierra hacia un tono más claro según "brillo"
  const base = hexToRgb(p.land);
  const lift = 26 + settings.land * 70;
  const r = Math.min(255, base.r + lift * 0.5);
  const g = Math.min(255, base.g + lift * 0.75);
  const b = Math.min(255, base.b + lift);
  return `rgb(${r|0},${g|0},${b|0})`;
}

/* ---------------------------------------------------------------------------
   6. COLOR DEL GLOBO Y GLOW (tweakables)
--------------------------------------------------------------------------- */
function aplicarColorGlobo() {
  const p = OCEAN_PRESETS[settings.oceanIdx];
  const mat = GLOBE.globeMaterial();
  if (window.THREE && mat.color) {
    mat.color = new THREE.Color(p.ocean);
    mat.emissive = new THREE.Color(p.ocean);
    mat.emissiveIntensity = 0.12;
    mat.shininess = 14;
  } else if (mat.color && mat.color.set) {
    mat.color.set(p.ocean);
    if (mat.emissive) mat.emissive.set(p.ocean);
  }
  // refrescar continentes si ya están
  if (GLOBE.polygonsData() && GLOBE.polygonsData().length) {
    GLOBE.polygonCapColor(() => landCapColor());
  }
}

function aplicarGlow() {
  GLOBE.atmosphereAltitude(0.10 + settings.glow * 0.13);
}

/* ---------------------------------------------------------------------------
   7. PUNTOS + ANILLOS (filtrados)
--------------------------------------------------------------------------- */
function visibles() {
  return DATA.filter(d => activos.has(d.tipo));
}
let _faros = [];      // cache de faros visibles (oportunidades)
let VIS_UNIS = [];    // universidades realmente en pantalla (cara visible + en rango de zoom)
const MAX_VISIBLE_UNIS = 96;
function refrescarPuntos() {
  _faros = visibles();
  GLOBE.pointsData(_faros);
  GLOBE.ringsData(_faros); // todos los puntos pulsan
  actualizarMarcadores(GLOBE.pointOfView());     // arma htmlElementsData con culling
  document.getElementById('countNum').textContent = _faros.length;
}

/* Culling: sólo mandamos al render los marcadores que de verdad se ven —
   cara visible del globo (dotp con la cámara) y dentro del rango de zoom.
   Los demás tendrían opacidad 0 igualmente, así que sacarlos del htmlElementsData
   evita que globe.gl los reproyecte en cada frame. Apariencia idéntica. */
function actualizarMarcadores(pov) {
  const alt = (pov && pov.altitude != null) ? pov.altitude : GLOBE.pointOfView().altitude;
  const vis = [];
  if (uniVisible && alt <= UNI_SHOW_ALT && UNI_DATA.length) {
    const cam = GLOBE.camera();
    const cp = cam.position;
    const camLen = Math.hypot(cp.x, cp.y, cp.z) || 1;
    const W = window.innerWidth, H = window.innerHeight, M = 80;  // margen fuera de pantalla
    const candidates = [];
    const cx = W / 2, cy = H / 2;
    for (const u of UNI_DATA) {
      const lat = markerLat(u), lng = markerLng(u);
      const c3 = GLOBE.getCoords(lat, lng, 0);
      const nlen = Math.hypot(c3.x, c3.y, c3.z) || 1;
      const dotp = (c3.x * cp.x + c3.y * cp.y + c3.z * cp.z) / (nlen * camLen);
      let keep = dotp >= 0.10;                       // cara visible del globo
      if (keep) {                                     // y dentro del viewport (con margen)
        const s = GLOBE.getScreenCoords(lat, lng, 0);
        keep = s.x >= -M && s.x <= W + M && s.y >= -M && s.y <= H + M;
        if (keep) u._screenD = (s.x - cx) * (s.x - cx) + (s.y - cy) * (s.y - cy);
      }
      if (keep) {
        candidates.push(u);
      } else {
        const el = uniEls.get(u.uid);
        if (el) el.style.opacity = '0';   // entra ya invisible cuando vuelva a verse
      }
    }
    candidates.sort((a, b) => a._screenD - b._screenD);
    vis.push(...candidates.slice(0, MAX_VISIBLE_UNIS));
    for (let i = MAX_VISIBLE_UNIS; i < candidates.length; i++) {
      const el = uniEls.get(candidates[i].uid);
      if (el) el.style.opacity = '0';
    }
  } else if (UNI_DATA.length) {
    for (const u of UNI_DATA) {
      const el = uniEls.get(u.uid);
      if (el) el.style.opacity = '0';
    }
  }
  VIS_UNIS = vis;
  GLOBE.htmlElementsData(_faros.concat(vis));
}

/* el cilindro se achica (alto y radio) a medida que se hace zoom */
/* el cilindro se achica (alto y radio) a medida que se hace zoom */
let lastCylF = -1;
let dotAlt = 0;                 // el punto brilloso vive en la BASE del cilindro
function ajustarCilindros(alt) {
  const raw = Math.max(0.12, Math.min(1, (alt - 0.06) / (2.4 - 0.06)));
  const f = Math.round(raw * 20) / 20;     // cuantizado: solo recalcula por pasos
  if (f === lastCylF) return;
  lastCylF = f;
  dotAlt = BASE_ALT * f;                    // punta superior del cilindro
  GLOBE
    .pointAltitude(() => BASE_ALT * f)
    .pointRadius(() => 0.78 * f)
    .htmlAltitude(htmlAltAccessor);          // faro en la PUNTA del cilindro (uni en la superficie)
}

/* ---------------------------------------------------------------------------
   7.b PUNTO BRILLOSO en el centro del cilindro (se achica al hacer zoom)
--------------------------------------------------------------------------- */
function crearPuntoBrillo(d) {
  let el = dotEls.get(d.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'cyl-dot';
    el.style.setProperty('--c', TIPOS[d.tipo].color);
    el.innerHTML = '<div class="cyl-aura"></div><div class="cyl-core"></div>';
    dotEls.set(d.id, el);
  }
  return el;
}

/* altura del elemento HTML: universidad sobre la superficie, faro en la punta del cilindro */
function htmlAltAccessor(d) {
  return (d && d.kind === 'uni') ? 0.0 : BASE_ALT * (lastCylF > 0 ? lastCylF : 1);
}
/* fábrica que despacha según el tipo de dato */
function crearHtmlEl(d) {
  return (d && d.kind === 'uni') ? crearMarcadorUni(d) : crearPuntoBrillo(d);
}
/* marcador pequeño de universidad (ícono clicable) */
function crearMarcadorUni(d) {
  let el = uniEls.get(d.uid);
  if (!el) {
    el = document.createElement('div');
    el.className = 'uni-mark';
    el.innerHTML = '<img src="assets/uni.png" alt="" draggable="false">';
    el.addEventListener('click', (e) => { e.stopPropagation(); ocultarUniTip(); abrirUniversidad(d); });
    el.addEventListener('mouseenter', () => mostrarUniTip(d, el));
    el.addEventListener('mouseleave', ocultarUniTip);
    uniEls.set(d.uid, el);
  }
  return el;
}

let _puntosLast = 0;
let puntosRAF = null;         // handle del rAF de puntos (para pausar/reanudar)
let starsRAF = null;          // handle del rAF de estrellas
let starsLoop = null;         // referencia al loop de estrellas para reanudar
let _unisOcultas = false;     // flag: ya apagamos las unis (evita reescribir cada frame)
let _lastUScale = -1;         // última escala de ícono de uni aplicada (solo cambia con zoom)
let _lastCoreScale = -1;      // última escala de núcleo de faro aplicada
const UNI_SHOW_ALT = 2.85;        // por encima de esta altitud, las universidades se ocultan
function animarPuntos(now) {
  if (document.hidden) { puntosRAF = null; return; }   // pausa con la pestaña oculta
  puntosRAF = requestAnimationFrame(animarPuntos);
  if (now - _puntosLast < 33) return;   // ~30 fps
  _puntosLast = now;
  const cam = GLOBE.camera();
  if (!cam) return;
  const cp = cam.position;
  const camLen = Math.hypot(cp.x, cp.y, cp.z) || 1;
  const alt = Math.max(0.04, camLen / 100 - 1);
  const f = lastCylF > 0 ? lastCylF : 1;

  // faros de oportunidades (set cacheado; se actualiza al cambiar filtros)
  const v = _faros;
  if (v.length) {
    // el núcleo se achica al acercarse (solo depende del zoom)
    const coreScale = Math.max(0.34, Math.min(1.6, alt * 0.7));
    const coreChanged = Math.abs(coreScale - _lastCoreScale) > 0.002;
    _lastCoreScale = coreScale;
    const cstr = 'scale(' + coreScale.toFixed(3) + ')';
    for (const d of v) {
      const el = dotEls.get(d.id);
      if (!el) continue;
      // oclusión: producto punto en la punta del cilindro
      const c3 = GLOBE.getCoords(d.lat, d.lng, BASE_ALT * f);
      const nlen = Math.hypot(c3.x, c3.y, c3.z) || 1;
      const dotp = (c3.x * cp.x + c3.y * cp.y + c3.z * cp.z) / (nlen * camLen);
      el.style.opacity = Math.max(0, Math.min(1, (dotp - 0.10) / 0.20));
      // largo proyectado del cilindro en pantalla (base -> punta)
      const bs = GLOBE.getScreenCoords(d.lat, d.lng, 0);
      const ts = GLOBE.getScreenCoords(d.lat, d.lng, BASE_ALT * f);
      const trail = Math.hypot(bs.x - ts.x, bs.y - ts.y);
      // el aura (60px base) queda compacta sobre la punta del cilindro
      const auraScale = Math.max(coreScale * 0.5, (trail * 0.6 + 16) / 60);
      const aura = el.children[0], core = el.children[1];
      if (aura) aura.style.transform = 'scale(' + auraScale.toFixed(3) + ')';   // depende de rotación
      if (core && coreChanged) core.style.transform = cstr;                      // solo cambia con zoom
    }
  }

  // marcadores de universidades: oclusión (cara visible) + escala según zoom
  if (uniVisible && UNI_DATA.length) {
    const show = alt <= UNI_SHOW_ALT;
    if (!show) {
      // zoom lejano: apagar una sola vez, luego saltar el bucle entero
      if (!_unisOcultas) {
        for (const u of UNI_DATA) {
          const el = uniEls.get(u.uid);
          if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
        }
        _unisOcultas = true;
      }
    } else {
      _unisOcultas = false;
      const uScale = Math.max(0.55, Math.min(1.0, 1.12 - alt * 0.2)); // más chico de lejos
      const scaleChanged = Math.abs(uScale - _lastUScale) > 0.002;    // solo cambia con zoom
      _lastUScale = uScale;
      const ustr = 'scale(' + uScale.toFixed(3) + ')';
      const visibleUnis = VIS_UNIS.length ? VIS_UNIS : UNI_DATA;
      for (const u of visibleUnis) {
        const el = uniEls.get(u.uid);
        if (!el) continue;
        const c3 = GLOBE.getCoords(markerLat(u), markerLng(u), 0);
        const nlen = Math.hypot(c3.x, c3.y, c3.z) || 1;
        const dotp = (c3.x * cp.x + c3.y * cp.y + c3.z * cp.z) / (nlen * camLen);
        const op = Math.max(0, Math.min(1, (dotp - 0.12) / 0.18));
        el.style.opacity = op.toFixed(2);
        el.style.pointerEvents = op > 0.55 ? 'auto' : 'none';
        // escalamos el ÍCONO (hijo); su tamaño solo cambia con el zoom, no al rotar
        if (scaleChanged) {
          const img = el.children[0];
          if (img) img.style.transform = ustr;
        }
      }
    }
  } else if (uniVisible === false && !_unisOcultas) {
    // filtro de unis desactivado: apagar una vez
    for (const u of UNI_DATA) {
      const el = uniEls.get(u.uid);
      if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
    }
    _unisOcultas = true;
  }
}

/* ---------------------------------------------------------------------------
   8. TOOLTIP (hover)
--------------------------------------------------------------------------- */
function tooltipHTML(d) {
  const t = TIPOS[d.tipo];
  return `
    <div class="gl-tip">
      <div class="tt-type" style="color:${t.color}">
        <span class="d" style="background:${t.color}"></span>${t.label}
      </div>
      <div class="tt-title">${d.titulo}</div>
      <div class="tt-due">Vence: <b>${fmtFecha(d.fechaLimite)}</b></div>
    </div>`;
}
function onHover(pt) {
  document.getElementById('globeViz').style.cursor = pt ? 'pointer' : 'grab';
}

/* tooltip flotante para universidades (reusa estilo .gl-tip) */
let _uniTipEl = null;
function uniTipEl() {
  if (!_uniTipEl) {
    _uniTipEl = document.createElement('div');
    _uniTipEl.className = 'uni-tip';
    document.body.appendChild(_uniTipEl);
  }
  return _uniTipEl;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function mostrarUniTip(u, anchor) {
  const tip = uniTipEl();
  tip.innerHTML =
    '<div class="gl-tip">' +
      '<div class="tt-type">Universidad</div>' +
      '<div class="tt-title">' + escapeHtml(u.name) + '</div>' +
      '<div class="tt-rank">QS 2026: <b>#' + escapeHtml(u.rank || '—') + '</b> · ' + escapeHtml(u.country || '') + '</div>' +
    '</div>';
  const r = anchor.getBoundingClientRect();
  tip.style.left = (r.left + r.width / 2) + 'px';
  tip.style.top = r.top + 'px';
  tip.classList.add('show');
}
function ocultarUniTip() { if (_uniTipEl) _uniTipEl.classList.remove('show'); }

/* ---------------------------------------------------------------------------
   9. PANEL DE DETALLE (click / tap)
--------------------------------------------------------------------------- */
let detalleActivo = null;
function abrirDetalle(d) {
  if (!d) return;
  detalleActivo = d;
  cerrarUniversidad();
  const t = TIPOS[d.tipo];
  const det = document.getElementById('detail');

  det.querySelector('#d-type .d').style.background = t.color;
  det.querySelector('.d-type-txt').textContent = t.label;
  det.querySelector('#d-type').style.background = hexA(t.color, 0.16);
  det.querySelector('#d-type').style.borderColor = hexA(t.color, 0.5);
  det.querySelector('#d-type').style.color = t.color;
  det.querySelector('#d-glow').style.background = `radial-gradient(circle, ${t.color}, transparent 70%)`;

  det.querySelector('#d-title').textContent = d.titulo;
  det.querySelector('#d-days').textContent = d.diasRestantes;
  det.querySelector('#d-open').textContent = d.fechaApertura ? fmtFecha(d.fechaApertura) : '—';
  det.querySelector('#d-close').textContent = fmtFecha(d.fechaLimite);
  det.querySelector('#d-mod').textContent = capitalizar(d.modalidad);
  det.querySelector('#d-lang').textContent = d.idioma;
  det.querySelector('#d-coords').textContent = fmtCoords(d.lat, d.lng);

  const cd = det.querySelector('#d-countdown');
  cd.classList.toggle('urgent', d.diasRestantes <= URGENTE_DIAS);

  det.classList.add('open');
  det.setAttribute('aria-hidden', 'false');

  // enfocar el punto
  GLOBE.controls().autoRotate = false;
  GLOBE.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.8 }, 900);
}
function cerrarDetalle() {
  detalleActivo = null;
  const det = document.getElementById('detail');
  det.classList.remove('open');
  det.setAttribute('aria-hidden', 'true');
  reanudarRotacion(1200);
}
function wireDetalle() {
  document.getElementById('detailClose').addEventListener('click', cerrarDetalle);
  document.getElementById('d-cta').addEventListener('click', () => {
    document.getElementById('d-cta').animate(
      [{transform:'scale(1)'},{transform:'scale(.96)'},{transform:'scale(1)'}], {duration:180});
    if (detalleActivo) window.open(googleMapsUrl(detalleActivo.lat, detalleActivo.lng), '_blank', 'noopener');
  });
}

/* ---------------------------------------------------------------------------
   9.b TARJETA DE UNIVERSIDAD (click en marcador)
--------------------------------------------------------------------------- */
function abrirUniversidad(u) {
  if (!u) return;
  cerrarDetalle();
  const det = document.getElementById('uniDetail');
  det.querySelector('#u-title').textContent = u.name;
  det.querySelector('#u-rank').textContent = u.rank ? '#' + u.rank : '—';
  const sc = parseFloat(u.score);
  det.querySelector('#u-score').textContent = isFinite(sc) ? sc.toFixed(1) : (u.score || '—');
  det.querySelector('#u-scorebar').style.width = (isFinite(sc) ? Math.max(3, Math.min(100, sc)) : 0) + '%';
  det.querySelector('#u-country').textContent = u.country || '—';
  det.querySelector('#u-coords').textContent = fmtCoords(u.lat, u.lng);
  const maps = det.querySelector('#u-maps');
  maps.href = googleMapsUrl(u.lat, u.lng);
  maps.style.display = '';
  det.classList.add('open');
  det.setAttribute('aria-hidden', 'false');
  GLOBE.controls().autoRotate = false;
  GLOBE.pointOfView({ lat: markerLat(u), lng: markerLng(u), altitude: 1.3 }, 900);
}
function cerrarUniversidad() {
  const det = document.getElementById('uniDetail');
  if (!det) return;
  det.classList.remove('open');
  det.setAttribute('aria-hidden', 'true');
  reanudarRotacion(1200);
}
function wireUniversidades() {
  const t = document.getElementById('uniToggle');
  if (t) t.addEventListener('click', () => {
    uniVisible = !uniVisible;
    t.setAttribute('aria-pressed', uniVisible ? 'true' : 'false');
    _unisOcultas = false;   // forzar reevaluación de opacidad en el próximo frame
    refrescarPuntos();
    if (!uniVisible) { cerrarUniversidad(); ocultarUniTip(); }
  });
  const close = document.getElementById('uniClose');
  if (close) close.addEventListener('click', cerrarUniversidad);
}

/* ---------------------------------------------------------------------------
   10. FILTROS + LEYENDA
--------------------------------------------------------------------------- */
function construirFiltros() {
  const cont = document.getElementById('filters');
  cont.innerHTML = '';
  Object.entries(TIPOS).forEach(([key, t]) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-pressed', 'true');
    chip.innerHTML = `<span class="dot" style="background:${t.color};color:${t.color}"></span>${t.label}`;
    chip.addEventListener('click', () => {
      if (activos.has(key)) activos.delete(key); else activos.add(key);
      chip.setAttribute('aria-pressed', activos.has(key) ? 'true' : 'false');
      refrescarPuntos();
    });
    cont.appendChild(chip);
  });
}

/* ---------------------------------------------------------------------------
   11. SETTINGS (color del globo · glow · velocidad · brillo tierra)
--------------------------------------------------------------------------- */
function construirSwatches() {
  const cont = document.getElementById('oceanSwatches');
  cont.innerHTML = '';
  OCEAN_PRESETS.forEach((p, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.title = p.name;
    sw.style.background = `linear-gradient(135deg, ${p.ocean}, ${p.land})`;
    sw.setAttribute('aria-pressed', i === settings.oceanIdx ? 'true' : 'false');
    sw.addEventListener('click', () => {
      settings.oceanIdx = i;
      [...cont.children].forEach((c, j) => c.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
      aplicarColorGlobo();
    });
    cont.appendChild(sw);
  });
}
function wireSettings() {
  const panel = document.getElementById('settings');
  document.getElementById('settingsBtn').addEventListener('click', () => panel.classList.toggle('open'));
  document.getElementById('settingsClose').addEventListener('click', () => panel.classList.remove('open'));

  const glow = document.getElementById('glowRange');
  glow.addEventListener('input', () => {
    settings.glow = +glow.value / 100;
    document.getElementById('glowVal').textContent = glow.value + '%';
    aplicarGlow();
  });

  const rot = document.getElementById('rotRange');
  rot.addEventListener('input', () => {
    settings.rotSpeed = +rot.value / 100;
    document.getElementById('rotVal').textContent = settings.rotSpeed.toFixed(2);
    GLOBE.controls().autoRotateSpeed = settings.rotSpeed;
  });

  const land = document.getElementById('landRange');
  land.addEventListener('input', () => {
    settings.land = +land.value / 100;
    document.getElementById('landVal').textContent =
      settings.land < 0.34 ? 'Bajo' : settings.land < 0.67 ? 'Medio' : 'Alto';
    if (GLOBE.polygonsData() && GLOBE.polygonsData().length)
      GLOBE.polygonCapColor(() => landCapColor());
  });
}

/* ---------------------------------------------------------------------------
   12. ROTACIÓN: pausa al interactuar, reanuda tras inactividad
--------------------------------------------------------------------------- */
let reanudarTimer = null;
function wireRotationPause() {
  const el = document.getElementById('globeViz');
  const pausar = () => {
    GLOBE.controls().autoRotate = false;
    if (reanudarTimer) clearTimeout(reanudarTimer);
  };
  ['mousedown', 'touchstart', 'wheel'].forEach(ev =>
    el.addEventListener(ev, pausar, { passive: true }));
  ['mouseup', 'touchend'].forEach(ev =>
    el.addEventListener(ev, () => reanudarRotacion(2600), { passive: true }));
  el.addEventListener('wheel', () => reanudarRotacion(2600), { passive: true });
}
function reanudarRotacion(delay) {
  if (reanudarTimer) clearTimeout(reanudarTimer);
  const det = document.getElementById('detail');
  const uni = document.getElementById('uniDetail');
  reanudarTimer = setTimeout(() => {
    const abierto = det.classList.contains('open') || (uni && uni.classList.contains('open'));
    if (!abierto) GLOBE.controls().autoRotate = true;
  }, delay);
}

/* ---------------------------------------------------------------------------
   12.b ESTRELLAS TITILANTES (canvas de fondo)
--------------------------------------------------------------------------- */
function initStars() {
  const cv = document.getElementById('stars');
  if (!cv) return;
  const ctx = cv.getContext('2d', { alpha: true });
  let stars = [];
  function resize() {
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    const n = Math.min(260, Math.round((cv.width * cv.height) / 11000));
    stars = Array.from({ length: n }, () => {
      const tint = Math.random();
      const hue = tint < 0.10 ? '0,199,221'      // cian
                : tint < 0.17 ? '253,168,24'      // dorado
                : '226,238,255';                  // blanco frío
      return {
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        r: Math.random() * 1.2 + 0.3,
        base: Math.random() * 0.45 + 0.3,
        amp: Math.random() * 0.4 + 0.18,
        sp: Math.random() * 1.1 + 0.35,
        ph: Math.random() * Math.PI * 2,
        hue
      };
    });
  }
  resize();
  window.addEventListener('resize', resize);

  // ~30 fps: el titileo no necesita 60 fps y libera el hilo para el globo
  let t = 0, last = 0;
  function loop(now) {
    if (document.hidden) { starsRAF = null; return; }   // pausa con la pestaña oculta
    starsRAF = requestAnimationFrame(loop);
    if (now - last < 33) return;
    last = now;
    t += 0.033;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const s of stars) {
      let a = s.base + Math.sin(t * s.sp + s.ph) * s.amp;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      ctx.fillStyle = `rgba(${s.hue},${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    }
  }
  starsLoop = loop;             // expuesto para reanudar al volver a la pestaña
  starsRAF = requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------------------
   13. UTILIDADES
--------------------------------------------------------------------------- */
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function hexA(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function capitalizar(s) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/* arranque */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
