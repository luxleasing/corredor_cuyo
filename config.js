window.LUX_CONFIG = {
  municipio: {
    nombre: 'Corredor Cuyo · RN7',
    tituloAplicacion: 'Corredor Cuyo · Tramos Este y Oeste',
    mapaInicial: { center: [-68.55, -32.90], zoom: 9 }
  },

  fuentes: {
    corredor: './corredor_cuyo_2026_wgs84.geojson'
  },

  // Valores EXACTOS del campo "sector"
  tramos: {
    este:  { key: 'Este (Límite SL-Mza - Palmira)', label: 'Tramo Este',  sublabel: 'Límite SL-Mza → Palmira' },
    oeste: { key: 'Oeste(Palmira - Las Cuevas)',    label: 'Tramo Oeste', sublabel: 'Palmira → Las Cuevas' }
  },

  campos: {
    sector:     'sector',
    tecnologia: ['Luminaria', 'luminaria', 'LUMINARIA'],
    potencia:   ['Potencia', 'potencia', 'POTENCIA', 'pot', 'watts', 'WATTS']
  },

  // Simbología: LED, Sodio y Falta (3 categorías del campo Luminaria)
  simbologia: {
    LED:   '#22d3ee',  // cian
    SODIO: '#e2f916',  // amarillo
    FALTA: '#f43f5e',  // rojo/rosado — oportunidad de instalación
    OTROS: '#94a3b8'   // gris para valores inesperados
  },

  consumo: {
    horasDiarias: 11,
    diasMes: 30,
    tarifaKwh: 85,
    // Supuestos para cálculo de ahorro (ajustables por tramo si querés)
    potenciaLEDReemplazoW: 150,   // LED que reemplaza al sodio
    potenciaSodioAsumidaW: 400,   // si el punto de sodio no trae potencia
    factorCO2kgPorKwh: 0.42
  },

  estilosMapa: {
    light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    satellite: {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles © Esri'
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
    }
  }
};