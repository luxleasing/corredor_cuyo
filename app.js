// 1. Configuración básica
const CONFIG = window.LUX_CONFIG;
const map = new maplibregl.Map({
  container: 'mapa',
  style: CONFIG.estilosMapa.satellite, // Usa el estilo de tu config
  center: [-68.55, -32.90],
  zoom: 10
});

// 2. Función para obtener campo tolerante a mayúsculas
function getProp(props, campo) {
  if (!props) return null;
  if (props[campo] !== undefined) return props[campo];
  for (const k in props) {
    if (k.toLowerCase() === campo.toLowerCase()) return props[k];
  }
  return null;
}

// 3. Función principal
map.on('load', async () => {
  try {
    // Descargar datos
    const res = await fetch(CONFIG.fuentes.corredor);
    if (!res.ok) throw new Error("No se pudo cargar el archivo .geojson");
    const geojson = await res.json();

    // Variables para contar
    let stats = { este: {total:0, led:0, sodio:0}, oeste: {total:0, led:0, sodio:0} };

    // Recorremos todos los puntos para contar
    geojson.features.forEach(f => {
      const p = f.properties;
      const sector = getProp(p, CONFIG.campos.sector);
      const tech = String(getProp(p, CONFIG.campos.tecnologia) || "").toUpperCase();

      // Clasificar sector
      let tramo = null;
      if (sector === CONFIG.tramos.este) tramo = 'este';
      else if (sector === CONFIG.tramos.oeste) tramo = 'oeste';

      // Si tiene un tramo válido, sumamos
      if (tramo) {
        stats[tramo].total++;
        if (tech.includes('LED')) stats[tramo].led++;
        else if (tech.includes('SODIO')) stats[tramo].sodio++;
      }
    });

    // Actualizar los HTML con los números calculados
    document.getElementById('total-este').innerText = stats.este.total;
    document.getElementById('led-este').innerText = stats.este.led;
    document.getElementById('sodio-este').innerText = stats.este.sodio;

    document.getElementById('total-oeste').innerText = stats.oeste.total;
    document.getElementById('led-oeste').innerText = stats.oeste.led;
    document.getElementById('sodio-oeste').innerText = stats.oeste.sodio;

    // 4. Agregar los puntos al mapa
    map.addSource('puntos', { type: 'geojson', data: geojson });

    // Capa Tramo Este (Filtrada)
    map.addLayer({
      id: 'capa-este',
      type: 'circle',
      source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.este],
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'case',
          ['in', 'LED', ['upcase', ['get', CONFIG.campos.tecnologia]]], CONFIG.simbologia.LED,
          ['in', 'SODIO', ['upcase', ['get', CONFIG.campos.tecnologia]]], CONFIG.simbologia.SODIO,
          CONFIG.simbologia.OTROS
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000'
      }
    });

    // Capa Tramo Oeste (Filtrada)
    map.addLayer({
      id: 'capa-oeste',
      type: 'circle',
      source: 'puntos',
      filter: ['==', ['get', CONFIG.campos.sector], CONFIG.tramos.oeste],
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'case',
          ['in', 'LED', ['upcase', ['get', CONFIG.campos.tecnologia]]], CONFIG.simbologia.LED,
          ['in', 'SODIO', ['upcase', ['get', CONFIG.campos.tecnologia]]], CONFIG.simbologia.SODIO,
          CONFIG.simbologia.OTROS
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000'
      }
    });

    // 5. Lógica de los Checkboxes para prender/apagar
    document.getElementById('chk-este').addEventListener('change', (e) => {
      map.setLayoutProperty('capa-este', 'visibility', e.target.checked ? 'visible' : 'none');
    });
    
    document.getElementById('chk-oeste').addEventListener('change', (e) => {
      map.setLayoutProperty('capa-oeste', 'visibility', e.target.checked ? 'visible' : 'none');
    });

  } catch (error) {
    alert("ERROR: " + error.message);
    console.error(error);
  }
});
