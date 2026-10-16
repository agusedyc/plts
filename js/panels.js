export const DEFAULT_PANELS = [
  {
    id: 'solana-550',
    name: 'SOLANA-MONO-24V-550wp',
    brand: 'Solana',
    wp: 550,
    vmp: 42.1,
    imp: 13.06,
    voc: 50.1,
    isc: 13.90,
    priceIdr: 1650000,
  },
  {
    id: 'lesso-550',
    name: 'LESSO-550Wp P-Type',
    brand: 'LESSO',
    wp: 550,
    vmp: 42.0,
    imp: 13.10,
    voc: 49.82,
    isc: 13.97,
    priceIdr: 1750000,
  },
  {
    id: 'lesso-580',
    name: 'LESSO-580Wp N-Type TOPCon',
    brand: 'LESSO',
    wp: 580,
    vmp: 42.75,
    imp: 13.57,
    voc: 51.43,
    isc: 14.33,
    priceIdr: 1850000,
  },
  {
    id: 'jinko-585',
    name: 'Jinko Tiger Neo 585Wp N-Type',
    brand: 'Jinko Solar',
    wp: 585,
    vmp: 43.65,
    imp: 13.40,
    voc: 52.36,
    isc: 14.15,
    priceIdr: 1890000,
  },
  {
    id: 'longi-575',
    name: 'Longi Hi-MO 6 Explorer 575Wp',
    brand: 'Longi Solar',
    wp: 575,
    vmp: 43.91,
    imp: 13.10,
    voc: 52.46,
    isc: 14.20,
    priceIdr: 1850000,
  },
  {
    id: 'trina-620',
    name: 'Trina Solar Vertex 620Wp',
    brand: 'Trina Solar',
    wp: 620,
    vmp: 41.4,
    imp: 14.99,
    voc: 49.6,
    isc: 15.91,
    priceIdr: 2150000,
  },
  {
    id: 'trina-630',
    name: 'Trina Solar Vertex 630Wp',
    brand: 'Trina Solar',
    wp: 630,
    vmp: 40.68,
    imp: 15.49,
    voc: 48.9,
    isc: 16.38,
    priceIdr: 2250000,
  },
  {
    id: 'trina-720',
    name: 'Trina Solar Vertex 720Wp',
    brand: 'Trina Solar',
    wp: 720,
    vmp: 41.3,
    imp: 17.44,
    voc: 49.4,
    isc: 18.49,
    priceIdr: 2650000,
  },
];

export async function fetchPanelsDatabase(url = 'data/panels.json') {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback to default panels
  }
  return DEFAULT_PANELS;
}

export function findPanelById(id, panels = DEFAULT_PANELS) {
  return panels.find((p) => p.id === id) || null;
}
