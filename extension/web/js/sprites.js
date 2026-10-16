// sprites.js — carga y cachea los sprites recortados de las referencias (objetos, ladron, poli).
// Si un sprite aun no existe, image.complete/naturalWidth seran falsy y el render usa su fallback.
//
// Asignacion estable de objeto -> sprite: por VALOR (los mas caros reciben los tesoros mas vistosos),
// decidido en la app con asignarSprites(); aqui solo precargamos y servimos por clave.

const BASE = 'assets/sprites/';
// version para romper la cache de Cloudflare (la estampa deploy.sh en window.__V); vacia en local.
const VER = (typeof window !== 'undefined' && window.__V) ? ('?v=' + window.__V) : '';

// Catalogo de objetos robables (claves = nombre de fichero sin extension), de mas a menos "vistoso".
// El orden importa: asignarSprites() reparte por valor descendente.
export const CATALOGO_OBJETOS = [
  'corona', 'rubi', 'mascara', 'cofre', 'trofeo', 'busto', 'casco_samurai',
  'casco_caballero', 'globo', 'craneo_trex', 'anfora', 'reloj_arena',
  'fosil_pez', 'retrato', 'amonite', 'catalejo',
];

const cache = new Map();
function cargar(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);
  const img = new Image();
  img.src = BASE + nombre + '.webp' + VER;
  cache.set(nombre, img);
  return img;
}

export const sprites = {
  // objeto(key): key puede ser un nombre del catalogo o un indice numerico (fallback ciclico).
  objeto(key) {
    if (typeof key === 'number') key = CATALOGO_OBJETOS[key % CATALOGO_OBJETOS.length];
    if (!key) return null;
    return cargar(key);
  },
  ladron(fase) { return cargar('ladron'); },      // Mortadelo ladron (sprite completo)
  poli() { return cargar('poli'); },
  coche() { return cargar('coche'); },
};

// Precarga todo (llamar al arrancar). Devuelve promesa que resuelve cuando cargan (o fallan).
export function precargar() {
  const nombres = [...CATALOGO_OBJETOS, 'ladron', 'poli', 'coche'];
  return Promise.all(nombres.map(n => new Promise(res => {
    const img = cargar(n);
    if (img.complete) return res();
    img.onload = () => res(); img.onerror = () => res();
  })));
}

// Reparte sprites a los objetos por valor descendente (estable). Devuelve array de claves por indice.
export function asignarSprites(values) {
  const idx = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
  const keys = new Array(values.length);
  idx.forEach((objIndex, rank) => { keys[objIndex] = CATALOGO_OBJETOS[rank % CATALOGO_OBJETOS.length]; });
  return keys;
}
