/* ============================================================================
   LUX · Corredor Cuyo · Tramo Este vs Tramo Oeste
   ============================================================================ */

const APP = window.LUX_CONFIG;

let datos = { type: 'FeatureCollection', features: [] };
let mapEste, mapOeste;
let estiloActual = 'satellite';
let sincronizando = false;
let statsGlobales = null;

const $ = id => document.getElementById(id);
const fmtNum = (n, dec = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtMoney = n =>
  '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

/* ── Diagnóstico ──────────────────────────────────────────────────── */
function setDiag(msg, tipo = 'error') {
  const el = $('diagnostico');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = tipo === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(22,163,74,0.92)';
  if (tipo === 'info') setTimeout(() => el.classList.add('hidden'), 3500);
  console.log(`[LUX/${tipo}]`, msg);
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function getCampo(props, campoODef, def = null) {
  if (!props) return def;
  const campos = Array.isArray(campoODef) ? campoODef : [campoODef];
  for (const c of campos) {
    const v = props[c];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return def;
}

function clasificarTecnologia(valor) {
  const v = String(valor || '').toUpperCase().trim();
  if (v === 'LED') return 'LED';
  if (v.includes('SODIO') || v.includes('SAP')) return 'SODIO';
  if (v.includes('FALTA') || v === '') return 'FALTA';
  return 'OTROS';
}

/* Clasifica sector: devuelve 'este' | 'oeste' | null */
function clasificarSector(props) {
  const raw = getCampo(props, APP.campos.sector, null);
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === APP.tramos.este.key)  return 'este';
  if (s === APP.tramos.oeste.key) return 'oeste';
  // fallback tolerante (por si cambian tildes/espacios)
  if (/^Este/i.test(s))  return 'este';
  if (/^Oeste/i.test(s)) return 'oeste';
  return null;
}

/* ── Expresión de color ───────────────────────────────────────────── */
function colorExpression() {
  const campos = APP.campos.tecnologia;
  const S = APP.simbologia;
  const getTec = ['upcase', ['to-string',
    ['coalesce', ...campos.map(c => ['get', c]), '']
  ]];

  return [
    'case',
    ['==', getTec, 'LED'], S.LED,
    ['in', 'SODIO', getTec], S.SODIO,
    ['any',
      ['==', getTec, 'FALTA'],
      ['==', getTec, '']
    ], S.FALTA,
    S.OTROS
  ];
}

/* ── Pre-procesar datos: agregar _sector y _tech normalizados ─────── */
function preprocesar(fc) {
  for (const f of fc.features || []) {
    const p = f.properties || (f.properties = {});
    p._sector = clasificarSector(p) || 'sin-sector';
    p._tech   = clasificarTecnologia(getCampo(p, APP.campos.tecnologia, ''));
  }
  return fc;
}

/* ── Inicialización de mapas ──────────────────────────────────────── */
function initMapas() {
  if (typeof maplibregl === 'undefined') {
    setDiag('MapLibre GL no cargó.');
    return;
  }

  const estilo = APP.estilosMapa[estiloActual];
  const centro = APP.municipio.mapaInicial.center;
  const zoom   = APP.municipio.mapaInicial.zoom;

  mapOeste = new maplibregl.Map({
    container: 'map-oeste',
    style: estilo,
    center: centro,
    zoom: zoom,
    minZoom: 7,
    maxZoom: 20,
    preserveDrawingBuffer: true,
    interactive: true
  });

  mapEste = new maplibregl.Map({
    container: 'map-este',
    style: estilo,
    center: centro,
    zoom: zoom,
    minZoom: 7,
    maxZoom: 20,
    preserveDrawingBuffer: true,
    interactive: false
  });

  mapOeste.on('move', () => {
    if (sincronizando) return;
    sincronizando = true;
    mapEste.jumpTo({
      center: mapOeste.getCenter(),
      zoom: mapOeste.getZoom(),
      bearing: mapOeste.getBearing(),
      pitch: mapOeste.getPitch()
    });
    sincronizando = false;
  });

  mapOeste.getCanvas().style.cursor = 'grab';
  mapOeste.on('mousedown', () => { mapOeste.getCanvas().style.cursor = 'grabbing'; });
  mapOeste.on('mouseup',   () => { mapOeste.getCanvas().style.cursor = 'grab'; });

  let cargados = 0;
  const onLoad = () => {
    cargados++;
    if (cargados === 2) {
      setDiag('Descargando datos…', 'info');
      cargarDatos();
    }
  };
  mapEste.on('load', onLoad);
  mapOeste.on('load', onLoad);
}

/* ── Carga de datos y capas filtradas por sector ─────────────────── */
async function cargarDatos() {
  try {
    const r = await fetch(APP.fuentes.corredor, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    datos = preprocesar(await r.json());

    const total = datos.features.length;
    const nEste = datos.features.filter(f => f.properties._sector === 'este').length;
    const nOeste = datos.features.filter(f => f.properties._sector === 'oeste').length;
    const nSin = total - nEste - nOeste;
    setDiag(`Total: ${fmtNum(total)} · Este: ${fmtNum(nEste)} · Oeste: ${fmtNum(nOeste)} · Sin sector: ${fmtNum(nSin)}`, 'info');

    // ── Capa común: fuente única
    const buildLayers = (map) => {
      if (!map.getSource('corredor')) {
        map.addSource('corredor', { type: 'geojson', data: datos });
      }
      const paint = {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 16, 8],
        'circle-color': colorExpression(),
        'circle-opacity': 0.92,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': 'rgba(0,0,0,0.55)'
      };
      const filterBySector = (sec) => ['==', ['get', '_sector'], sec];

      if (!map.getLayer('lyr-sin-sector')) {
        map.addLayer({
          id: 'lyr-sin-sector', type: 'circle', source: 'corredor',
          filter: filterBySector('sin-sector'),
          paint: { ...paint, 'circle-opacity': 0.35, 'circle-radius': 2 }
        });
      }
      if (!map.getLayer('lyr-este')) {
        map.addLayer({
          id: 'lyr-este', type: 'circle', source: 'corredor',
          filter: filterBySector('este'), paint
        });
      }
      if (!map.getLayer('lyr-oeste')) {
        map.addLayer({
          id: 'lyr-oeste', type: 'circle', source: 'corredor',
          filter: filterBySector('oeste'), paint
        });
      }
    };

    buildLayers(mapEste);
    buildLayers(mapOeste);

    // ── Etiqueta de luminaria al hover (solo en el mapa interactivo) ──
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    mapOeste.on('mousemove', 'lyr-este', (e) => {
      const f = e.features[0];
      popup.setLngLat(e.lngLat).setHTML(htmlPopup(f.properties)).addTo(mapOeste);
      mapOeste.getCanvas().style.cursor = 'pointer';
    });
    mapOeste.on('mousemove', 'lyr-oeste', (e) => {
      const f = e.features[0];
      popup.setLngLat(e.lngLat).setHTML(htmlPopup(f.properties)).addTo(mapOeste);
      mapOeste.getCanvas().style.cursor = 'pointer';
    });
    mapOeste.on('mouseleave', 'lyr-este', () => { popup.remove(); mapOeste.getCanvas().style.cursor = 'grab'; });
    mapOeste.on('mouseleave', 'lyr-oeste', () => { popup.remove(); mapOeste.getCanvas().style.cursor = 'grab'; });

    initSwipe();
    calcularKPIs();

  } catch (err) {
    console.error(err);
    setDiag('Error: ' + err.message);
  }
}

function htmlPopup(p) {
  const tech = p._tech || '—';
  const pot  = getCampo(p, APP.campos.potencia, null);
  const sec  = p._sector === 'este' ? 'Tramo Este'
             : p._sector === 'oeste' ? 'Tramo Oeste'
             : 'Sin sector';
  const color = APP.simbologia[tech] || '#94a3b8';
  return `
    <div style="font-family:Archivo,sans-serif;font-size:11px;line-height:1.35">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
        <b>${tech}</b>
      </div>
      <div style="color:#475569">${sec}</div>
      <div style="color:#475569">Potencia: <b>${pot ?? '—'} W</b></div>
    </div>`;
}

/* ── Swipe ───────────────────────────────────────────────────────── */
function initSwipe() {
  const container = $('comparison-container');
  const divider   = $('swipe-divider');
  const paneEste  = $('map-este');
  const hint      = $('swipe-hint');

  let pct = 50;
  let arrastrando = false;
  let orientacion = 'v';

  const esPortrait = () => window.matchMedia('(orientation: portrait)').matches;

  const aplicarOrientacion = () => {
    orientacion = esPortrait() ? 'h' : 'v';