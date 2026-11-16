const CONFIG = window.LUX_CONFIG;
let map;
let capasVisibles = { este: true, oeste: true };

// Función para obtener propiedad sin importar mayúsculas
function getProp(props, campo) {
  if (!props) return null;
  if (props[campo] !== undefined) return props[campo];
  for (const k in props) {
    if (k.toLowerCase() === campo.toLowerCase()) return props[k];
  }
  return null;
}

// Iniciar mapa
map = new maplibregl.Map({
  container: 'mapa',
  style: CONFIG.estilosMapa.satellite,
  center: [-68.55, -32.90],
  zoom: 10
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

map.on('load', async () => {
  try {
    const res = await fetch(CONFIG.fuentes.corredor);
    if (!res.ok) throw new Error("No se pudo cargar el .geojson");
    const geojson = await res.json();

    let stats = { este: {total:0, led:0, sodio:0, falta:0}, oeste: {total:0, led:0, sodio:0, falta:0} };

    // Contar datos
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
        else stats[tramo].falta++; // Asumimos que "falta" es el resto o el string "FALTA"
      }
    });

    // Actualizar HTML
    document.getElementById('total-este').innerText = stats.este.total;
    document.getElementById('led-este').innerText = stats.este.led;
    document.getElementById('sodio-este').innerText = stats.este.sodio;
    document.getElementById('falta-este').innerText = stats.este.falta;

    document.getElementById('total-oeste').innerText = stats.oeste.total;
    document.getElementById('led-oeste').innerText = stats.oeste.led;
    document.getElementById('sodio-oeste').innerText = stats.oeste.sodio;
    document.getElementById('falta-oeste').innerText = stats.oeste.falta;

    // Agregar al mapa
    map.addSource('puntos', { type: 'geojson', data: geojson });

    // Expresión de color (con los colores desaturados del CSS)
    const colorExpr = [
      'case',
      ['in', 'LED', ['upcase', ['to-string', ['get', CONFIG.campos.tecnologia]]]], '#38bdf8',   // Celeste
      ['in', 'SODIO', ['upcase', ['to-string', ['get', CONFIG.campos.tecnologia]]]], '#fde047', // Amarillo
      '#fda4af' // Rosa (falta)
    ];

    // Capa Este
    map.addLayer({
      id: 'capa-este',
      type: 'circle',
      source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.este],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
        'circle-color': colorExpr,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Capa Oeste
    map.addLayer({
      id: 'capa-oeste',
      type: 'circle',
      source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.oeste],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
        'circle-color': colorExpr,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });

  } catch (err) {
    alert("Error: " + err.message);
    console.error(err);
  }
});

// Lógica para botones de encendido/apagado
function toggleLayer(tramo) {
  capasVisibles[tramo] = !capasVisibles[tramo];
  
  const capaId = `capa-${tramo}`;
  const btnId = `btn-${tramo}`;
  
  if (map.getLayer(capaId)) {
    map.setLayoutProperty(capaId, 'visibility', capasVisibles[tramo] ? 'visible' : 'none');
  }
  
  const btn = document.getElementById(btnId);
  if (capasVisibles[tramo]) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}
