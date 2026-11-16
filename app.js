const APP = window.LUX_CONFIG;
let datos = { type: 'FeatureCollection', features: [] };
let mapEste, mapOeste;
let sincronizando = false;

const $ = id => document.getElementById(id);
const fmtNum = (n) => n.toLocaleString('es-AR');

function showError(msg) {
  const el = $('diagnostico');
  el.style.display = 'block';
  el.textContent = 'ERROR: ' + msg;
}

function initMapas() {
  if (typeof maplibregl === 'undefined') return showError('MapLibre no cargó.');

  mapOeste = new maplibregl.Map({
    container: 'map-oeste', style: APP.estilosMapa.satellite,
    center: APP.municipio.center, zoom: APP.municipio.zoom
  });

  mapEste = new maplibregl.Map({
    container: 'map-este', style: APP.estilosMapa.satellite,
    center: APP.municipio.center, zoom: APP.municipio.zoom
  });

  mapOeste.on('move', () => {
    if (sincronizando) return;
    sincronizando = true;
    mapEste.jumpTo({ center: mapOeste.getCenter(), zoom: mapOeste.getZoom() });
    sincronizando = false;
  });

  let cargados = 0;
  const onLoad = () => {
    if (++cargados === 2) cargarDatos();
  };
  mapEste.on('load', onLoad);
  mapOeste.on('load', onLoad);
}

async function cargarDatos() {
  try {
    const r = await fetch(APP.fuentes.corredor);
    if (!r.ok) throw new Error(`HTTP ${r.status} - Archivo no encontrado`);
    datos = await r.json();
    procesarDatosYMapa();
  } catch (err) {
    console.warn("Fallo el fetch del archivo real. Usando datos dummy de prueba.");
    // DATOS DE PRUEBA PARA QUE VEAS QUE FUNCIONA
    datos = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [-68.50, -32.90] }, properties: { sector: APP.tramos.este, Luminaria: "Led", Potencia: 150 } },
        { type: "Feature", geometry: { type: "Point", coordinates: [-68.52, -32.91] }, properties: { sector: APP.tramos.este, Luminaria: "Sodio", Potencia: 400 } },
        { type: "Feature", geometry: { type: "Point", coordinates: [-68.60, -32.92] }, properties: { sector: APP.tramos.oeste, Luminaria: "Falta", Potencia: 0 } },
        { type: "Feature", geometry: { type: "Point", coordinates: [-68.65, -32.93] }, properties: { sector: APP.tramos.oeste, Luminaria: "Sodio", Potencia: 250 } }
      ]
    };
    showError("No se pudo leer el .geojson. Usando datos de prueba.");
    procesarDatosYMapa();
  }
}

function procesarDatosYMapa() {
  // Agregar capas
  const colorExp = [
    'case',
    ['==', ['upcase', ['get', APP.campos.tecnologia]], 'LED'], APP.simbologia.LED,
    ['==', ['upcase', ['get', APP.campos.tecnologia]], 'SODIO'], APP.simbologia.SODIO,
    ['==', ['upcase', ['get', APP.campos.tecnologia]], 'FALTA'], APP.simbologia.FALTA,
    APP.simbologia.OTROS
  ];

  [mapEste, mapOeste].forEach(map => {
    map.addSource('corredor', { type: 'geojson', data: datos });
    map.addLayer({
      id: 'lyr', type: 'circle', source: 'corredor',
      paint: { 'circle-radius': 6, 'circle-color': colorExp, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
    });
  });

  calcularKPIs();
  initSwipe();
}

function calcularKPIs() {
  const calc = (key) => {
    const feats = datos.features.filter(f => f.properties[APP.campos.sector] === APP.tramos[key]);
    let led=0, sodio=0, falta=0;
    feats.forEach(f => {
      const t = String(f.properties[APP.campos.tecnologia] || '').toUpperCase();
      if(t === 'LED') led++;
      else if(t === 'SODIO') sodio++;
      else if(t === 'FALTA') falta++;
    });
    return { total: feats.length, led, sodio, falta };
  };

  const setKpi = (key, d) => {
    $(`kpi-total-${key}`).innerText = fmtNum(d.total);
    $(`kpi-led-${key}`).innerText = fmtNum(d.led);
    $(`kpi-sodio-${key}`).innerText = fmtNum(d.sodio);
    $(`kpi-falta-${key}`).innerText = fmtNum(d.falta);
  };

  setKpi('este', calc('este'));
  setKpi('oeste', calc('oeste'));
}

function initSwipe() {
  const container = $('comparison-container');
  const divider = $('swipe-divider');
  const paneEste = $('map-este');
  let dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    if(x === undefined) return;
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    paneEste.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    divider.style.left = pct + '%';
  };

  divider.addEventListener('mousedown', (e) => { dragging = true; onMove(e); });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', () => dragging = false);
  
  divider.addEventListener('touchstart', (e) => { dragging = true; onMove(e); }, {passive: false});
  window.addEventListener('touchmove', (e) => { if(dragging) { e.preventDefault(); onMove(e); } }, {passive: false});
  window.addEventListener('touchend', () => dragging = false);
}

document.addEventListener('DOMContentLoaded', () => {
  initMapas();
  $('map-style-select').addEventListener('change', (e) => {
    const style = APP.estilosMapa[e.target.value];
    mapEste.setStyle(style);
    mapOeste.setStyle(style);
    mapEste.once('styledata', () => procesarDatosYMapa());
    mapOeste.once('styledata', () => procesarDatosYMapa());
  });
});
