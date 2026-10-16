// engine.js — motor del golpe con tiempo, portado 1:1 del Python (museo.py + ruta.py + golpe.py).
// Sin dependencias, sin DOM: lo usan tanto el navegador como el test de paridad en Node.
//
// Decisiones de portabilidad:
//   - El plano es un array de strings igual que en Python ('#' pared, '.' suelo, 'E' entrada/salida).
//   - El DP de rutas usa bitmasks (n<=10) en vez de frozenset: mismo algoritmo, mucho mas rapido.
//   - La tabla de rutas SOLO depende de plano+posiciones. Capacidad/tiempo/velocidad son un filtro
//     posterior (elegirGolpe), que es O(2^n) y se puede repetir en cada frame sin recalcular el DP.
//   - Endurecido frente a objetos inalcanzables: el BFS de Python lanzaria KeyError; aqui marcamos
//     la distancia como Infinity y el objeto queda excluido del solver (bit nunca activable).

export const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const RAIZ2 = Math.SQRT2;
export const EPS = 1e-9;
// 8 direcciones con coste 1 / sqrt(2): velocidad constante, el paso diagonal recorre mas distancia.
const MOVIMIENTOS = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, RAIZ2], [-1, 1, RAIZ2], [1, -1, RAIZ2], [1, 1, RAIZ2],
];

export function buscarEntrada(plano) {
  for (let fila = 0; fila < plano.length; fila++) {
    const col = plano[fila].indexOf('E');
    if (col !== -1) return [fila, col];
  }
  return null;
}

function transitable(plano, f, c) {
  return f >= 0 && f < plano.length && c >= 0 && c < plano[f].length && plano[f][c] !== '#';
}

// Monticulo binario minimo sobre [distancia, fila, col] (suficiente para Dijkstra de la rejilla).
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; const n = a.length;
      for (;;) { let s = i, l = 2 * i + 1, r = l + 1;
        if (l < n && a[l][0] < a[s][0]) s = l; if (r < n && a[r][0] < a[s][0]) s = r;
        if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } }
    return top; }
}

// Dijkstra de 8 vecinos (coste 1 / sqrt(2)), sin cortar esquinas (diagonal prohibida si una de
// las dos celdas ortogonales adyacentes es muro). Devuelve Map "f,c"->dist y Map venimosDe.
export function recorrerPlano(plano, origen) {
  const dist = new Map();
  const venimosDe = new Map();
  const k = (f, c) => f + ',' + c;
  dist.set(k(origen[0], origen[1]), 0);
  venimosDe.set(k(origen[0], origen[1]), null);
  const heap = new MinHeap();
  heap.push([0, origen[0], origen[1]]);
  while (heap.size) {
    const [d, fila, col] = heap.pop();
    if (d > dist.get(k(fila, col)) + EPS) continue;
    for (const [df, dc, coste] of MOVIMIENTOS) {
      const nf = fila + df, nc = col + dc;
      if (!transitable(plano, nf, nc)) continue;
      if (df !== 0 && dc !== 0 && !(transitable(plano, fila + df, col) && transitable(plano, fila, col + dc))) continue;
      const nd = d + coste, kk = k(nf, nc);
      const prev = dist.has(kk) ? dist.get(kk) : Infinity;
      if (nd < prev - EPS) {
        dist.set(kk, nd);
        venimosDe.set(kk, [fila, col]);
        heap.push([nd, nf, nc]);
      }
    }
  }
  return { pasos: dist, venimosDe };
}

// Tabla de distancias andando. Punto 0 = entrada, puntos 1..n = objetos (en orden).
// Si un punto es inalcanzable desde otro, la distancia es Infinity (no KeyError).
export function matrizDistancias(plano, objetos) {
  const puntos = [buscarEntrada(plano), ...objetos];
  const tabla = [];
  for (const origen of puntos) {
    const { pasos } = recorrerPlano(plano, origen);
    tabla.push(puntos.map(([f, c]) => {
      const v = pasos.get(f + ',' + c);
      return v === undefined ? Infinity : v;
    }));
  }
  return tabla;
}

// Camino celda a celda por el mas corto. Devuelve [] si el destino es inalcanzable.
export function camino(plano, origen, destino) {
  const { venimosDe } = recorrerPlano(plano, origen);
  const k = (c) => c[0] + ',' + c[1];
  if (!venimosDe.has(k(destino))) return [];
  const celdas = [];
  let celda = destino;
  while (celda !== null) {
    celdas.push(celda);
    celda = venimosDe.get(k(celda));
  }
  celdas.reverse();
  return celdas;
}

// Rutas mas cortas para CADA subconjunto de objetos (DP tipo Held-Karp sobre bitmasks).
// Devuelve { porMascara: {mask -> {distancia, orden}}, alcanzables: bitmask de objetos alcanzables }.
// Objetos inalcanzables (dist Infinity desde la entrada o entre si) quedan fuera: cualquier
// mascara que los incluya tiene distancia Infinity, asi que el solver nunca los elige.
export function rutasMasCortas(dist) {
  const n = dist.length - 1;
  // alcanzable[j] si se puede ir entrada->objeto y objeto->entrada (ida y vuelta posible)
  let alcanzables = 0;
  for (let j = 1; j <= n; j++) {
    if (dist[0][j] !== Infinity && dist[j][0] !== Infinity) alcanzables |= (1 << (j - 1));
  }

  // mejor[mask][ultimo] = distancia minima desde la entrada visitando `mask` y acabando en `ultimo`.
  // ultimo es el indice de objeto 0..n-1 (bit). Infinity = inalcanzable.
  const mejor = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
  const prev = Array.from({ length: 1 << n }, () => new Int8Array(n).fill(-1));
  for (let j = 0; j < n; j++) {
    const d = dist[0][j + 1];
    if (d !== Infinity) { mejor[1 << j][j] = d; prev[1 << j][j] = -1; } // -1 = veniamos de la entrada
  }
  for (let mask = 1; mask < (1 << n); mask++) {
    for (let ult = 0; ult < n; ult++) {
      if (!(mask & (1 << ult)) || mejor[mask][ult] === Infinity) continue;
      const base = mejor[mask][ult];
      for (let sig = 0; sig < n; sig++) {
        if (mask & (1 << sig)) continue;
        const paso = dist[ult + 1][sig + 1];
        if (paso === Infinity) continue;
        const nm = mask | (1 << sig);
        const nd = base + paso;
        if (nd < mejor[nm][sig]) { mejor[nm][sig] = nd; prev[nm][sig] = ult; }
      }
    }
  }

  // Cerrar el circuito (volver a la entrada) y reconstruir el orden para cada mascara.
  const porMascara = new Map();
  porMascara.set(0, { distancia: 0, orden: [] });
  for (let mask = 1; mask < (1 << n); mask++) {
    let mejorD = Infinity, mejorUlt = -1;
    for (let ult = 0; ult < n; ult++) {
      if (!(mask & (1 << ult)) || mejor[mask][ult] === Infinity) continue;
      const vuelta = dist[ult + 1][0];
      if (vuelta === Infinity) continue;
      const total = mejor[mask][ult] + vuelta;
      if (total < mejorD) { mejorD = total; mejorUlt = ult; }
    }
    if (mejorUlt === -1) { porMascara.set(mask, { distancia: Infinity, orden: [] }); continue; }
    const orden = [];
    let m = mask, ult = mejorUlt;
    while (ult !== -1) {
      orden.push(ult);
      const p = prev[m][ult];
      m ^= (1 << ult);
      ult = p;
    }
    orden.reverse();
    porMascara.set(mask, { distancia: mejorD, orden });
  }
  return { porMascara, alcanzables };
}

// Mejor golpe: el subconjunto de mas valor con volumen<=capacidad y distancia<=distanciaMax.
// Empate de valor: gana la menor distancia (igual que Python). Devuelve tambien la mascara.
export function elegirGolpe(rutas, values, volumes, capacity, distanciaMax) {
  let mejor = { valor: 0, volumen: 0, distancia: 0, orden: [], mask: 0 };
  for (const [mask, { distancia, orden }] of rutas.porMascara) {
    if (distancia === Infinity || distancia > distanciaMax + EPS) continue;
    let valor = 0, volumen = 0;
    for (const i of orden) { valor += values[i]; volumen += volumes[i]; }
    if (volumen > capacity) continue;
    if (valor > mejor.valor || (valor === mejor.valor && distancia < mejor.distancia)) {
      mejor = { valor, volumen, distancia, orden, mask };
    }
  }
  return mejor;
}

// Ruta mas corta para un grupo CONCRETO de objetos (indices), para el "plan propio".
// Reutiliza la tabla ya calculada. Devuelve {distancia, orden, valor, volumen, factible}.
export function rutaDeGrupo(rutas, indices, values, volumes) {
  let mask = 0;
  for (const i of indices) mask |= (1 << i);
  const r = rutas.porMascara.get(mask) || { distancia: Infinity, orden: [] };
  let valor = 0, volumen = 0;
  for (const i of r.orden) { valor += values[i]; volumen += volumes[i]; }
  return { distancia: r.distancia, orden: r.orden, valor, volumen, mask,
           factible: r.distancia !== Infinity };
}

// Camino completo celda a celda: entrada -> objetos en orden -> entrada.
export function caminoCompleto(plano, objetos, orden) {
  const entrada = buscarEntrada(plano);
  const paradas = [entrada, ...orden.map(i => objetos[i]), entrada];
  let celdas = [entrada];
  for (let i = 0; i < paradas.length - 1; i++) {
    const tramo = camino(plano, paradas[i], paradas[i + 1]);
    celdas = celdas.concat(tramo.slice(1));
  }
  return celdas;
}

// planificar(): mismo contrato que golpe.py. Calcula el DP una vez y deriva todo.
export function planificar(plano, objetos, values, volumes, capacity, tiempo, velocidad) {
  const dist = matrizDistancias(plano, objetos);
  const rutas = rutasMasCortas(dist);
  const golpe = elegirGolpe(rutas, values, volumes, capacity, velocidad * tiempo);
  const sinLimite = elegirGolpe(rutas, values, volumes, capacity, Infinity);

  const curva = [];
  const topeT = Number.isFinite(sinLimite.distancia) ? Math.floor(sinLimite.distancia / velocidad) + 11 : 11;
  for (let t = 0; t < topeT; t += 10) {
    const g = elegirGolpe(rutas, values, volumes, capacity, velocidad * t);
    curva.push({ tiempo: t, valor: g.valor, objetos: g.orden.length });
  }

  const listaObjetos = objetos.map((o, i) => ({
    id: LETRAS[i], fila: o[0], col: o[1],
    valor: Math.trunc(values[i]), volumen: Math.trunc(volumes[i]),
    cogido: golpe.orden.includes(i),
    alcanzable: !!(rutas.alcanzables & (1 << i)),
  }));
  const celdas = caminoCompleto(plano, objetos, golpe.orden);
  return {
    parametros: { capacidad: capacity, tiempo, velocidad },
    plano,
    entrada: buscarEntrada(plano),
    objetos: listaObjetos,
    golpe: {
      orden: golpe.orden.map(i => LETRAS[i]), ordenIdx: golpe.orden,
      valor: golpe.valor, volumen: golpe.volumen, distancia: golpe.distancia,
      tiempo: golpe.distancia / velocidad,
      camino: celdas.map(c => [c[0], c[1]]),
    },
    valor_sin_limite_de_tiempo: sinLimite.valor,
    valor_segun_tiempo: curva,
    rutas, // se reutiliza para el plan propio sin recalcular
  };
}
