// catalogo.js — los objetos del museo: cada dibujo tiene nombre y valores por defecto en escala humana.
// valor en euros, peso en kg. Siguen siendo editables en el panel (el valor y el peso de cada objeto).
// Capacidad de mochila entre 50-300 kg; botín óptimo de los 10 por defecto ronda los 100-105 k€.

export const CATALOGO = {
  busto:           { nombre: 'Busto romano',       valor: 7500,  peso: 40 },
  fosil_pez:       { nombre: 'Fósil de pez',        valor: 4000,  peso: 30 },
  rubi:            { nombre: 'Rubí gigante',         valor: 15000, peso: 2  },
  corona:          { nombre: 'Corona real',          valor: 22000, peso: 6  },
  mascara:         { nombre: 'Máscara de oro',       valor: 28000, peso: 11 },
  cofre:           { nombre: 'Cofre del tesoro',     valor: 14000, peso: 25 },
  craneo_trex:     { nombre: 'Cráneo de T-rex',      valor: 18000, peso: 55 },
  trofeo:          { nombre: 'Trofeo de oro',        valor: 5000,  peso: 5  },
  casco_samurai:   { nombre: 'Casco samurái',        valor: 10000, peso: 4  },
  retrato:         { nombre: 'Retrato real',         valor: 7000,  peso: 8  },
  globo:           { nombre: 'Globo terráqueo',      valor: 3000,  peso: 15 },
  anfora:          { nombre: 'Ánfora griega',        valor: 6500,  peso: 20 },
  reloj_arena:     { nombre: 'Reloj de arena',       valor: 1800,  peso: 3  },
  amonite:         { nombre: 'Amonites',             valor: 2500,  peso: 18 },
  casco_caballero: { nombre: 'Casco de caballero',   valor: 4500,  peso: 7  },
  catalejo:        { nombre: 'Catalejo',             valor: 2000,  peso: 2  },
};

export const CLAVES = Object.keys(CATALOGO);

// Los 10 objetos con los que arranca el museo (en este orden; el deslizador "objetos" quita desde el final).
export const ORDEN_DEFECTO = ['busto', 'fosil_pez', 'rubi', 'corona', 'mascara', 'cofre',
  'craneo_trex', 'trofeo', 'casco_samurai', 'retrato'];

const euros = new Intl.NumberFormat('de-DE');
export const fmtEuros = n => euros.format(Math.round(n));
export const fmtCorto = n => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n)));
