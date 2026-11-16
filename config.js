window.LUX_CONFIG = {
  municipio: {
    center: [-68.55, -32.90],
    zoom: 9
  },
  fuentes: {
    corredor: './corredor_cuyo_2026_wgs84.geojson'
  },
  tramos: {
    este: 'Este (Límite SL-Mza - Palmira)',
    oeste: 'Oeste(Palmira - Las Cuevas)'
  },
  campos: {
    sector: 'sector',
    tecnologia: 'Luminaria',
    potencia: 'Potencia'
  },
  simbologia: {
    LED: '#22d3ee',
    SODIO: '#e2f916',
    FALTA: '#f43f5e',
    OTROS: '#94a3b8'
  },
  estilosMapa: {
    light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    
    // GOOGLE SATELLITE (Límite de zoom: 20)
    google: {
      version: 8,
      sources: {
        'google-tiles': {
          type: 'raster',
          tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], // lyrs=s es satelital
          tileSize: 256,
          attribution: '© Google',
          maxzoom: 20
        }
      },
      layers: [{ id: 'google-layer', type: 'raster', source: 'google-tiles' }]
    },

    // ESRI WORLD IMAGERY (Límite de zoom: 19)
    satellite: {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles © Esri',
          maxzoom: 19
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
    }
  }
};
