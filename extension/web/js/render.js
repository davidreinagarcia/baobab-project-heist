// render.js — dibuja el museo en 2.5D (vista cenital oblicua estilo Clash Royale) sobre canvas 2D.
// Los cuadrados de la rejilla siguen siendo cuadrados (misma escala X e Y en el plano de juego):
// la "inclinacion" se consigue con los muros, que tienen altura y cara frontal, no deformando el suelo.
//
// Distingue tres tipos de celda: suelo interior (sala), muro (con volumen) y exterior (calle de
// noche, no transitable). El exterior lo marca la app via la funcion esExterior(f,c).
//
// En Phase D se sustituyen los colores planos por sprites recortados de las referencias y fondo
// nocturno; aqui el render ya expone los ganchos (dibujarObjeto/sprites) y el orden por profundidad.

import { sprites } from './sprites.js';

export const TILE = 30;            // lado de celda en px (cuadrada)
export const ESC_Y = 1.0;          // sin compresion: cuadrados reales; el 2.5D lo dan los muros
export const ALTO_MURO = 16;       // altura visual de los muros

export function dimsCanvas(plano) {
  const filas = plano.length, cols = plano[0].length;
  return { w: cols * TILE + 4, h: filas * TILE + ALTO_MURO + 4 };
}

// Centro en px de una celda. El personaje/objeto se dibuja "de pie" sobre esta base.
export function celdaACentro(fila, col) {
  return { x: col * TILE + TILE / 2 + 2, y: fila * TILE + TILE / 2 + ALTO_MURO };
}
export function celdaABase(fila, col) { // punto en el suelo (parte baja de la celda) para billboards
  return { x: col * TILE + TILE / 2 + 2, y: fila * TILE + TILE + ALTO_MURO - 4 };
}
export function pxACelda(x, y, plano) {
  const col = Math.floor((x - 2) / TILE);
  const fila = Math.floor((y - ALTO_MURO) / TILE);
  if (fila < 0 || col < 0 || fila >= plano.length || col >= plano[0].length) return null;
  return [fila, col];
}

// ---- Fondo nocturno + suelo de madera + haz de luna ----
function fondoNoche(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#10192e'); g.addColorStop(1, '#0a1120');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function dibujarSuelo(ctx, plano, esExterior) {
  for (let f = 0; f < plano.length; f++) {
    for (let c = 0; c < plano[f].length; c++) {
      if (plano[f][c] === '#') continue;
      if (esExterior && esExterior(f, c)) continue;        // exterior: no se pinta suelo
      const x = c * TILE + 2, y = f * TILE + ALTO_MURO;
      // tabla de madera oscura, veta alterna
      ctx.fillStyle = (f + c) % 2 === 0 ? '#3a2b22' : '#342620';
      ctx.fillRect(x, y, TILE, TILE + 1);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
      // iluminacion calida tenue hacia el centro de cada sala (brillo diagonal)
      ctx.fillStyle = 'rgba(255,196,120,.045)';
      ctx.fillRect(x, y, TILE, TILE / 2);
    }
  }
}

function esParedODentro(plano, f, c) {
  if (f < 0 || c < 0 || f >= plano.length || c >= plano[f].length) return true;
  return plano[f][c] === '#';
}

// Muros: cara superior clara + cara frontal oscura con textura de ladrillo. El exterior usa muros
// mas apagados (son la calle/oscuridad). Se dibuja de arriba a abajo para solapar bien.
function dibujarMuros(ctx, plano, esExterior, zona) {
  const f0 = zona ? Math.max(0, zona.f0) : 0, f1 = zona ? Math.min(plano.length - 1, zona.f1) : plano.length - 1;
  for (let f = f0; f <= f1; f++) {
    const c0 = zona ? Math.max(0, zona.c0) : 0, c1 = zona ? Math.min(plano[f].length - 1, zona.c1) : plano[f].length - 1;
    for (let c = c0; c <= c1; c++) {
      if (plano[f][c] !== '#') continue;
      const ext = esExterior && esExterior(f, c);
      if (ext) continue; // el exterior es noche: se deja el fondo, sin bloque de muro
      const x = c * TILE + 2, yTop = f * TILE + ALTO_MURO, top = yTop - ALTO_MURO;
      const frontal = !esParedODentro(plano, f + 1, c);
      const hFrontal = ALTO_MURO + (frontal ? TILE : 0);
      // cara frontal (oscura, ladrillo)
      ctx.fillStyle = '#1d2740';
      ctx.fillRect(x, top + 2, TILE, hFrontal);
      if (frontal) {
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
        for (let by = top + ALTO_MURO + 6; by < top + hFrontal; by += 8) {
          ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + TILE, by); ctx.stroke();
        }
      }
      // cara superior (azul pizarra con luz)
      ctx.fillStyle = (f + c) % 2 === 0 ? '#39456b' : '#333f63';
      ctx.fillRect(x, top, TILE, ALTO_MURO + 2);
      ctx.fillStyle = 'rgba(180,200,255,.10)';
      ctx.fillRect(x, top, TILE, 3);
      ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 1.4;
      ctx.strokeRect(x + .5, top + .5, TILE - 1, ALTO_MURO + (frontal ? TILE : 0));
    }
  }
}

// Vuelve a pintar los muros que quedan por delante de un personaje (filas por debajo de sus pies)
// para que se oculte tras ellos.
export function dibujarMurosDelante(ctx, plano, esExterior, px, py) {
  const fila = Math.floor((py - ALTO_MURO) / TILE), col = Math.floor((px - 2) / TILE);
  dibujarMuros(ctx, plano, esExterior, { f0: fila + 1, f1: fila + 2, c0: col - 1, c1: col + 1 });
}

// Rejilla de construccion (solo en modo construir)
export function dibujarRejilla(ctx, plano, esExterior) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let f = 0; f < plano.length; f++) for (let c = 0; c < plano[f].length; c++) {
    const x = c * TILE + 2, y = f * TILE + ALTO_MURO;
    ctx.strokeRect(x + .5, y + .5, TILE, TILE);
  }
  ctx.restore();
}

// Resaltado de la celda bajo el cursor
export function dibujarCeldaCursor(ctx, celda, color = 'rgba(255,255,255,.18)') {
  if (!celda) return;
  const x = celda[1] * TILE + 2, y = celda[0] * TILE + ALTO_MURO;
  ctx.fillStyle = color; ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
}

// Preview translucida de la edicion (verde anadir, rojo quitar)
export function dibujarPreview(ctx, celdas, modo) {
  if (!celdas || !celdas.length) return;
  ctx.save();
  ctx.fillStyle = modo === 'anadir' ? 'rgba(90,220,120,.45)' : 'rgba(240,80,70,.45)';
  ctx.strokeStyle = modo === 'anadir' ? '#3fae5a' : '#c23';
  ctx.lineWidth = 1.5;
  for (const [f, c] of celdas) {
    const x = c * TILE + 2, y = f * TILE + ALTO_MURO;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
  }
  ctx.restore();
}

// Entrada/salida: puerta con cartel verde "SALIDA"
function dibujarEntrada(ctx, entrada) {
  if (!entrada) return;
  const { x } = celdaACentro(entrada[0], entrada[1]);
  const yTop = entrada[0] * TILE + ALTO_MURO;
  ctx.save();
  // alfombra/umbral
  ctx.fillStyle = '#2a1d16';
  ctx.fillRect(x - TILE / 2, yTop, TILE, TILE);
  // marco de puerta
  ctx.fillStyle = '#5a3a22'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 2;
  ctx.fillRect(x - TILE * 0.38, yTop + 2, TILE * 0.76, TILE - 4);
  ctx.strokeRect(x - TILE * 0.38, yTop + 2, TILE * 0.76, TILE - 4);
  // cartel verde SALIDA
  ctx.fillStyle = '#1f8f3a'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 1.5;
  const cw = TILE * 0.92, ch = 10;
  ctx.fillRect(x - cw / 2, yTop - 11, cw, ch); ctx.strokeRect(x - cw / 2, yTop - 11, cw, ch);
  ctx.fillStyle = '#eafff0'; ctx.font = `bold 7px Baloo`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SALIDA', x, yTop - 6);
  ctx.restore();
}

// Sombra eliptica bajo billboards
export function sombra(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.34, 0, 0, Math.PI * 2); ctx.fill();
}

// ---- Objeto robable: sprite billboard con brillo pulsante + etiqueta de valor ----
export function dibujarObjeto(ctx, obj, idx, opts = {}) {
  if (opts.recogido) return;
  const { x } = celdaACentro(obj.fila, obj.col);
  const base = celdaABase(obj.fila, obj.col);
  const apagado = obj.alcanzable === false;
  const t = opts.t || 0;
  const pulso = 0.5 + 0.5 * Math.sin(t * 3 + idx);
  const sp = sprites.objeto(obj.spriteKey || idx);
  const lift = opts.lift || 0;        // levantado al arrastrar
  const escala = (opts.escala || 1);
  ctx.save();
  ctx.globalAlpha = apagado ? 0.45 : 1;
  sombra(ctx, x, base.y, TILE * 0.34 * escala);
  if (sp && sp.complete && sp.naturalWidth) {
    const h = TILE * 1.15 * escala;
    const w = h * (sp.naturalWidth / sp.naturalHeight);
    // destello dorado detras
    if (!apagado) {
      ctx.save(); ctx.globalAlpha = 0.12 + pulso * 0.16;
      const grd = ctx.createRadialGradient(x, base.y - h * 0.45, 2, x, base.y - h * 0.45, w);
      grd.addColorStop(0, '#ffe9a0'); grd.addColorStop(1, 'rgba(255,233,160,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, base.y - h * 0.45, w, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (apagado) ctx.filter = 'grayscale(1) brightness(.7)';
    ctx.drawImage(sp, x - w / 2, base.y - h - lift, w, h);
    ctx.filter = 'none';
  } else {
    // fallback mientras cargan los sprites: gema simple
    const r = TILE * 0.33 * escala;
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, base.y - r * 2.2 - lift); ctx.lineTo(x + r, base.y - r - lift);
    ctx.lineTo(x, base.y - lift); ctx.lineTo(x - r, base.y - r - lift); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // etiqueta de valor (moneda dorada)
  if (!opts.sinEtiqueta) {
    const ex = x + TILE * 0.32, ey = base.y - TILE * 1.05 * escala;
    const txt = obj.etiqueta || '';
    ctx.font = 'bold 9px Baloo'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pw = Math.max(16, ctx.measureText(txt).width + 8);
    ctx.fillStyle = '#ffce3a'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 1.5;
    roundRect(ctx, ex - pw / 2, ey - 7, pw, 14, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0c1220';
    ctx.fillText(txt, ex, ey + 0.5);
  }
  if (apagado) {
    ctx.fillStyle = '#ff5a4a'; ctx.font = '12px Bangers'; ctx.textAlign = 'center';
    ctx.fillText('X', x, base.y - TILE * 1.4);
  }
  ctx.restore();
}

// Objeto flotando en una posicion de pantalla concreta (mientras se arrastra)
export function dibujarObjetoFlotante(ctx, obj, idx, px, t) {
  const sp = sprites.objeto(obj.spriteKey != null ? obj.spriteKey : idx);
  const escala = 1.3;
  ctx.save();
  if (sp && sp.complete && sp.naturalWidth) {
    const h = TILE * 1.15 * escala, w = h * (sp.naturalWidth / sp.naturalHeight);
    ctx.drawImage(sp, px.x - w / 2, px.y - h, w, h);
  } else {
    const r = TILE * 0.33 * escala;
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px.x, px.y - r * 2.2); ctx.lineTo(px.x + r, px.y - r);
    ctx.lineTo(px.x, px.y); ctx.lineTo(px.x - r, px.y - r); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// Marcador destino tipo "pin" en una celda (para drag de objetos)
export function dibujarMarcadorDestino(ctx, celda, valida) {
  if (!celda) return;
  const { x } = celdaACentro(celda[0], celda[1]);
  const base = celdaABase(celda[0], celda[1]);
  ctx.save();
  ctx.strokeStyle = valida ? '#5adc78' : '#f0564a';
  ctx.fillStyle = valida ? 'rgba(90,220,120,.25)' : 'rgba(240,86,74,.25)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(x, base.y, TILE * 0.4, TILE * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ---- Camino: linea punteada animada con diagonales ----
export function dibujarCamino(ctx, camino, progreso = 1, opts = {}) {
  if (!camino || camino.length < 2) return;
  const hasta = opts.todo ? camino.length : Math.max(1, Math.floor(camino.length * progreso));
  ctx.save();
  ctx.strokeStyle = opts.color || 'rgba(255,210,77,.85)';
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (opts.punteado !== false) { ctx.setLineDash([3, 7]); ctx.lineDashOffset = -(opts.t || 0) * 22; }
  ctx.beginPath();
  for (let i = 0; i < hasta; i++) {
    const { x, y } = celdaACentro(camino[i][0], camino[i][1]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ---- Escena completa ----
export function dibujarEscena(ctx, estado) {
  const { plano, entrada, objetos, camino, progresoCamino, resaltar, esExterior,
          construir, celdaCursor, preview, previewModo, caminoPropio, t } = estado;
  const { w, h } = dimsCanvas(plano);
  ctx.clearRect(0, 0, w, h);
  fondoNoche(ctx, w, h);
  dibujarSuelo(ctx, plano, esExterior);
  if (construir) dibujarRejilla(ctx, plano, esExterior);
  // camino propio en curso (debajo de objetos)
  if (caminoPropio && caminoPropio.length > 1) dibujarCamino(ctx, caminoPropio, 1, { color: 'rgba(120,200,255,.9)', punteado: false, t });
  if (camino) dibujarCamino(ctx, camino, progresoCamino ?? 1, { t });
  dibujarMuros(ctx, plano, esExterior);
  dibujarEntrada(ctx, entrada);
  if (construir && celdaCursor) dibujarCeldaCursor(ctx, celdaCursor);
  if (construir && preview) dibujarPreview(ctx, preview, previewModo);
  // objetos ordenados por fila (profundidad): los de delante tapan a los de atras
  const orden = objetos.map((o, i) => ({ o, i })).sort((a, b) => a.o.fila - b.o.fila);
  for (const { o, i } of orden) {
    if (estado.arrastrando === i) continue; // se dibuja aparte, encima de todo
    const recogido = estado.recogidos && estado.recogidos.has(i);
    dibujarObjeto(ctx, o, i, { recogido, t });
    if (resaltar && resaltar.has(i)) {
      const { x } = celdaACentro(o.fila, o.col);
      const base = celdaABase(o.fila, o.col);
      ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -(t || 0) * 18;
      ctx.beginPath(); ctx.ellipse(x, base.y, TILE * 0.42, TILE * 0.24, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // re-dibujado de muros delante de objetos: perspectiva 2.5D correcta
  // (igual que dibujarMurosDelante para el personaje, pero para cada objeto visible)
  for (const { o, i } of orden) {
    if (estado.arrastrando === i) continue;
    if (estado.recogidos && estado.recogidos.has(i)) continue;
    const base = celdaABase(o.fila, o.col);
    dibujarMurosDelante(ctx, plano, esExterior, base.x, base.y);
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
