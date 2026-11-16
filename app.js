const APP = window.LUX_CONFIG;
let datos = { type: 'FeatureCollection', features: [] };
let mapEste, mapOeste;
let estiloActual = 'satellite';
let sincronizando = false;

const $ = id => document.getElementById(id);
const fmtNum = (n, dec = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function setDiag(msg, tipo = 'error') {
  const el = $('diagnostico');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = tipo === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(22,163,74,0.92)';
  if (tipo === 'info') setTimeout(() => el.classList.add('hidden'), 3500);
}

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

function clasificarSector(props) {
  const raw = getCampo(props, APP.campos.sector, null);
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === APP.tramos.este.key)  return 'este';
  if (s === APP.tramos.oeste.key) return 'oeste';
  if (/^Este/i.test(s))  return 'este';
  if (/^Oeste/i.test(s)) return 'oeste';
  return null;
}

function colorExpression() {
  const campos = APP.campos.tecnologia;
  const S = APP.simbologia;
  const getTec = ['upcase', ['to-string', ['coalesce', ...campos.map(c => ['get', c]), '']]];
  return [
    'case',
    ['==', getTec, 'LED'], S.LED,
    ['in', 'SODIO', getTec], S.SODIO,
    ['any', ['==', getTec, 'FALTA'], ['==', getTec, '']], S.FALTA,
    S.OTROS
  ];
}

function preprocesar(fc) {
  for (const f of fc.features || []) {
    const p = f.properties || (f.properties = {});
    p._sector = clasificarSector(p) || 'sin-sector';
    p._tech   = clasificarTecnologia(getCampo(p, APP.campos.tecnologia, ''));
  }
  return fc;
}

function initMapas() {
  if (typeof maplibregl === 'undefined') return setDiag('MapLibre GL no cargó.');
  
  const estilo = APP.estilosMapa[estiloActual];
  const centro = APP.municipio.mapaInicial.center;
  const zoom   = APP.municipio.mapaInicial.zoom;

  mapOeste = new maplibregl.Map({
    container: 'map-oeste', style: estilo, center: centro, zoom: zoom,
    minZoom: 7, maxZoom: 20, preserveDrawingBuffer: true, interactive: true
  });

  mapEste = new maplibregl.Map({
    container: 'map-este', style: estilo, center: centro, zoom: zoom,
    minZoom: 7, maxZoom: 20, preserveDrawingBuffer: true, interactive: false
  });

  mapOeste.on('move', () => {
    if (sincronizando) return;
    sincronizando = true;
    mapEste.jumpTo({ center: mapOeste.getCenter(), zoom: mapOeste.getZoom(), bearing: mapOeste.getBearing(), pitch: mapOeste.getPitch() });
    sincronizando = false;
  });

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

async function cargarDatos() {
  try {
    const r = await fetch(APP.fuentes.corredor, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    datos = preprocesar(await r.json());

    const total = datos.features.length;
    const nEste = datos.features.filter(f => f.properties._sector === 'este').length;
    const nOeste = datos.features.filter(f => f.properties._sector === 'oeste').length;
    setDiag(`Cargado: ${total} puntos (Este: ${nEste}, Oeste: ${nOeste})`, 'info');

    const buildLayers = (map) => {
      if (!map.getSource('corredor')) map.addSource('corredor', { type: 'geojson', data: datos });
      const paint = {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 16, 8],
        'circle-color': colorExpression(),
        'circle-opacity': 0.92,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': 'rgba(0,0,0,0.55)'
      };
      const fSec = (sec) => ['==', ['get', '_sector'], sec];

      if (!map.getLayer('lyr-sin-sector')) map.addLayer({ id: 'lyr-sin-sector', type: 'circle', source: 'corredor', filter: fSec('sin-sector'), paint: { ...paint, 'circle-opacity': 0.35, 'circle-radius': 2 } });
      if (!map.getLayer('lyr-este')) map.addLayer({ id: 'lyr-este', type: 'circle', source: 'corredor', filter: fSec('este'), paint });
      if (!map.getLayer('lyr-oeste')) map.addLayer({ id: 'lyr-oeste', type: 'circle', source: 'corredor', filter: fSec('oeste'), paint });
    };

    buildLayers(mapEste);
    buildLayers(mapOeste);

    initSwipe();
    calcularKPIs();
  } catch (err) {
    console.error(err);
    setDiag('Error: ' + err.message);
  }
}

function initSwipe() {
  const container = $('comparison-container');
  const divider   = $('swipe-divider');
  const paneEste  = $('map-este');
  const hint      = $('swipe-hint');
  let pct = 50, arrastrando = false, orientacion = 'v';

  const esPortrait = () => window.matchMedia('(orientation: portrait)').matches;
  const aplicarOrientacion = () => {
    orientacion = esPortrait() ? 'h' : 'v';
    container.classList.toggle('orientation-h', orientacion === 'h');
    container.classList.toggle('orientation-v', orientacion === 'v');
    aplicar();
  };
  const aplicar = () => {
    pct = Math.max(0, Math.min(100, pct));
    if (orientacion === 'h') { paneEste.style.clipPath = `inset(0 0 ${100 - pct}% 0)`; divider.style.top = pct + '%'; divider.style.left = ''; }
    else { paneEste.style.clipPath = `inset(0 ${100 - pct}% 0 0)`; divider.style.left = pct + '%'; divider.style.top = ''; }
    divider.setAttribute('aria-valuenow', Math.round(pct));
  };
  const desdeEvento = (e) => {
    const rect = container.getBoundingClientRect();
    if (orientacion === 'h') { const y = e.touches ? e.touches[0].clientY : e.clientY; pct = ((y - rect.top) / rect.height) * 100; }
    else { const x = e.touches ? e.touches[0].clientX : e.clientX; pct = ((x - rect.left) / rect.width) * 100; }
    aplicar();
  };
  const ocultarHint = () => hint && hint.classList.add('fade-out');

  divider.addEventListener('mousedown', (e) => { arrastrando = true; ocultarHint(); desdeEvento(e); e.preventDefault(); });
  window.addEventListener('mousemove', (e) => { if (arrastrando) { desdeEvento(e); e.preventDefault(); } });
  window.addEventListener('mouseup', () => arrastrando = false);
  divider.addEventListener('touchstart', (e) => { arrastrando = true; ocultarHint(); desdeEvento(e); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', (e) => { if (arrastrando) { desdeEvento(e); e.preventDefault(); } }, { passive: false });
  window.addEventListener('touchend', () => arrastrando = false);

  window.addEventListener('resize', aplicarOrientacion);
  window.addEventListener('orientationchange', () => setTimeout(aplicarOrientacion, 100));
  aplicarOrientacion();
}

function analizarTramo(sectorKey) {
  const feats = datos.features.filter(f => f.properties._sector === sectorKey);
  let led = 0, sodio = 0, falta = 0, otros = 0, watts = 0;

  for (const f of feats) {
    const tech = f.properties._tech;
    if (tech === 'LED') led++;
    else if (tech === 'SODIO') sodio++;
    else if (tech === 'FALTA') falta++;
    else otros++;

    const potRaw = getCampo(f.properties, APP.campos.potencia, null);
    if (potRaw !== null) {
      const pot = parseFloat(String(potRaw).replace(',', '.'));
      if (!isNaN(pot) && pot > 0) watts += pot;
    }
  }
  return { total: feats.length, led, sodio, falta, otros, watts, kw: watts / 1000 };
}

function calcularKPIs() {
  const este  = analizarTramo('este');
  const oeste = analizarTramo('oeste');
  const pct = (p, t) => t ? ((p / t) * 100).toFixed(1) + '%' : '0%';

  const pintar = (key, d) => {
    $('kpi-total-' + key).innerText = fmtNum(d.total);
    $('kpi-led-'   + key).innerText = `${fmtNum(d.led)} (${pct(d.led, d.total)})`;
    $('kpi-sodio-' + key).innerText = `${fmtNum(d.sodio)} (${pct(d.sodio, d.total)})`;
    $('kpi-falta-' + key).innerText = `${fmtNum(d.falta)} (${pct(d.falta, d.total)})`;
    $('potencia-'  + key).innerText = fmtNum(d.kw, 1) + ' kW';
    const t = d.total || 1;
    $('bar-led-'   + key).style.width = (d.led   / t) * 100 + '%';
    $('bar-sodio-' + key).style.width = (d.sodio / t) * 100 + '%';
    $('bar-falta-' + key).style.width = (d.falta / t) * 100 + '%';
  };

  pintar('este',  este);
  pintar('oeste', oeste);

  const sum = $('kpi-summary');
  if (sum) {
    sum.innerHTML = `
      <span class="sum-pill old" style="background:rgba(226,249,22,0.15);padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:5px">Este · ${fmtNum(este.total)}</span>
      <span class="sum-pill new" style="background:rgba(34,211,238,0.15);padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700">Oeste · ${fmtNum(oeste.total)}</span>
    `;
  }
}

function cambiarEstilo(nuevo) {
  estiloActual = nuevo;
  const estilo = APP.estilosMapa[nuevo];
  mapEste.setStyle(estilo);
  mapOeste.setStyle(estilo);
  mapEste.once('styledata', () => reinyectar(mapEste));
  mapOeste.once('styledata', () => reinyectar(mapOeste));
}

function reinyectar(map) {
  setTimeout(() => {
    if (!map.getSource('corredor')) map.addSource('corredor', { type: 'geojson', data: datos });
    const paint = { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 16, 8], 'circle-color': colorExpression(), 'circle-opacity': 0.92, 'circle-stroke-width': 0.5, 'circle-stroke-color': 'rgba(0,0,0,0.55)' };
    const fSec = (sec) => ['==', ['get', '_sector'], sec];
    if (!map.getLayer('lyr-sin-sector')) map.addLayer({ id: 'lyr-sin-sector', type: 'circle', source: 'corredor', filter: fSec('sin-sector'), paint: { ...paint, 'circle-opacity': 0.35, 'circle-radius': 2 } });
    if (!map.getLayer('lyr-este')) map.addLayer({ id: 'lyr-este', type: 'circle', source: 'corredor', filter: fSec('este'), paint });
    if (!map.getLayer('lyr-oeste')) map.addLayer({ id: 'lyr-oeste', type: 'circle', source: 'corredor', filter: fSec('oeste'), paint });
  }, 150);
}

function initUI() {
  const html = document.documentElement;
  const aplicarTema = (modo) => { if (modo === 'light') html.classList.remove('dark'); else html.classList.add('dark'); };

  $('map-style-select').addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'satellite') { html.classList.remove('dark'); cambiarEstilo('satellite'); }
    else { aplicarTema(val); cambiarEstilo(val); }
  });

  $('theme-toggle').addEventListener('click', () => {
    const esDark = !html.classList.contains('dark');
    aplicarTema(esDark ? 'dark' : 'light');
    const nuevoEstilo = esDark ? 'dark' : 'light';
    $('map-style-select').value = nuevoEstilo;
    cambiarEstilo(nuevoEstilo);
  });

  const kpiToggle = $('kpi-toggle');
  const kpiStrip  = $('kpi-strip');
  if (kpiToggle && kpiStrip) {
    kpiToggle.addEventListener('click', () => {
      const expanded = kpiStrip.classList.toggle('expanded');
      kpiToggle.setAttribute('aria-expanded', expanded);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initMapas();
  initUI();
});
