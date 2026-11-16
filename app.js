const CONFIG = window.LUX_CONFIG;
let map;
let capasVisibles = { este: true, oeste: true };

function getProp(props, campo) {
  if (!props) return null;
  if (props[campo] !== undefined) return props[campo];
  for (const k in props) {
    if (k.toLowerCase() === campo.toLowerCase()) return props[k];
  }
  return null;
}

function toggleLayer(tramo) {
  capasVisibles[tramo] = !capasVisibles[tramo];
  const capaId = `capa-${tramo}`;
  const btnId = `btn-${tramo}`;
  
  if (map && map.getLayer(capaId)) {
    map.setLayoutProperty(capaId, 'visibility', capasVisibles[tramo] ? 'visible' : 'none');
  }
  
  const btn = document.getElementById(btnId);
  if (capasVisibles[tramo]) btn.classList.add('active');
  else btn.classList.remove('active');
}

function agregarCapas() {
  if (!map.getSource('puntos')) return;

  // PUNTOS MÁS GRANDES: De lejos miden 7px, de cerca bajan a 3px.
  const radioExpr = ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 5, 15, 3];
  
  const colorExpr = [
    'case',
    ['in', 'LED', ['upcase', ['to-string', ['get', CONFIG.campos.tecnologia]]]], '#38bdf8',
    ['in', 'SODIO', ['upcase', ['to-string', ['get', CONFIG.campos.tecnologia]]]], '#fde047',
    '#fda4af'
  ];

  if (!map.getLayer('capa-este')) {
    map.addLayer({
      id: 'capa-este', type: 'circle', source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.este],
      paint: {
        'circle-radius': radioExpr,
        'circle-color': colorExpr,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#ffffff'
      }
    });
  }

  if (!map.getLayer('capa-oeste')) {
    map.addLayer({
      id: 'capa-oeste', type: 'circle', source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.oeste],
      paint: {
        'circle-radius': radioExpr,
        'circle-color': colorExpr,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}

map = new maplibregl.Map({
  container: 'mapa',
  style: CONFIG.estilosMapa.satellite,
  center: CONFIG.municipio.center,
  zoom: CONFIG.municipio.zoom
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

document.getElementById('map-style-select').addEventListener('change', (e) => {
  const estilo = CONFIG.estilosMapa[e.target.value];
  map.setStyle(estilo);
  map.once('styledata', () => setTimeout(() => agregarCapas(), 100));
});

map.on('load', async () => {
  try {
    const res = await fetch(CONFIG.fuentes.corredor);
    if (!res.ok) throw new Error("No se pudo cargar el .geojson");
    const geojson = await res.json();

    let stats = { 
      este: { total: 0, led: 0, sodio: 0, falta: 0 }, 
      oeste: { total: 0, led: 0, sodio: 0, falta: 0 } 
    };

    geojson.features.forEach(f => {
      const p = f.properties;
      const sector = getProp(p, CONFIG.campos.sector);
      const tech = String(getProp(p, CONFIG.campos.tecnologia) || "").toUpperCase();

      let tramo = null;
      if (sector === CONFIG.tramos.este) tramo = 'este';
      else if (sector === CONFIG.tramos.oeste) tramo = 'oeste';

      if (tramo) {
        stats[tramo].total++;
        if (tech.includes('LED')) stats[tramo].led++;
        else if (tech.includes('SODIO')) stats[tramo].sodio++;
        else stats[tramo].falta++; 
      }
    });

    document.getElementById('total-este').innerText = stats.este.total;
    document.getElementById('led-este').innerText = stats.este.led;
    document.getElementById('sodio-este').innerText = stats.este.sodio;
    document.getElementById('falta-este').innerText = stats.este.falta;

    document.getElementById('total-oeste').innerText = stats.oeste.total;
    document.getElementById('led-oeste').innerText = stats.oeste.led;
    document.getElementById('sodio-oeste').innerText = stats.oeste.sodio;
    document.getElementById('falta-oeste').innerText = stats.oeste.falta;

    map.addSource('puntos', { type: 'geojson', data: geojson });
    agregarCapas();

  } catch (err) {
    console.error(err);
    alert("Error al cargar datos: " + err.message);
  }
});
