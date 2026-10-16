// personajes.js — dibuja al ladron (Mortadelo), la policia y el coche usando los sprites recortados
// de las referencias de David (assets/sprites/). La animacion es por "marioneta de sprite completo":
// squash & stretch, balanceo (bob), inclinacion (tilt) y volteo segun direccion; sobre esto se
// superponen efectos dibujados a mano (gotas de sudor, estrellitas, esposas, polvo, sirena).
//
// El sprite base del ladron mira a la DERECHA; dir=-1 lo voltea. Se dibuja "de pie": su base se
// ancla en (x, y) = punto del suelo de la celda.

import { sprites } from './sprites.js';
import { TILE } from './render.js';

const ALTO_LADRON = 2.6 * TILE;   // alto del ladron en px (billboard)
const ALTO_POLI = 2.4 * TILE;

function sombraPie(ctx, x, y, w, alpha = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.34, 0, 0, Math.PI * 2); ctx.fill();
}

// dibuja un sprite anclado por su base, con escala no uniforme (sx,sy) para squash & stretch.
function billboard(ctx, img, x, yBase, alto, { dir = 1, sx = 1, sy = 1, tilt = 0, alpha = 1 } = {}) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const h = alto * sy;
  const w = h * (img.naturalWidth / img.naturalHeight) * sx;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, yBase);
  ctx.rotate(tilt);
  ctx.scale(dir, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return true;
}

// Dibuja al ladron centrado "de pie" en (x, y = suelo), escala s (TILE/40), mirando dir.
// fase: 'idle' | 'andar' | 'recoger' | 'celebrar' | 'pillado'. t = reloj en segundos. p = fase caminar 0..1.
export function dibujarLadron(ctx, x, y, s, dir, fase, t, p, extra = {}) {
  const img = sprites.ladron();
  const alto = ALTO_LADRON;
  let sx = 1, sy = 1, tilt = 0, bob = 0, salto = 0, alpha = 1;

  if (fase === 'idle') {
    sy = 1 + Math.sin(t * 2) * 0.015;            // respira
    sx = 1 - Math.sin(t * 2) * 0.015;
    tilt = Math.sin(t * 0.7) * 0.015;            // mira alrededor
  } else if (fase === 'andar') {
    const ang = p * Math.PI * 2;
    bob = -Math.abs(Math.sin(ang)) * 3.5 * s;    // saltitos al andar
    tilt = Math.sin(ang) * 0.03 + dir * 0.04;    // inclinado hacia delante (sigiloso)
    sy = 1 + Math.abs(Math.sin(ang)) * 0.04;     // stretch al subir
    sx = 1 - Math.abs(Math.sin(ang)) * 0.03;
  } else if (fase === 'recoger') {
    const k = Math.min(1, extra.prog ?? 0);
    sy = 1 - k * 0.12 * Math.sin(k * Math.PI);   // squash al agacharse
    sx = 1 + k * 0.10 * Math.sin(k * Math.PI);
    salto = Math.sin(k * Math.PI) * 6 * s;       // saltito al recoger
  } else if (fase === 'celebrar') {
    salto = Math.abs(Math.sin(t * 8)) * 10 * s;  // da saltos de alegria
    sy = 1 + Math.abs(Math.sin(t * 8)) * 0.06;
    tilt = Math.sin(t * 8) * 0.05;
  } else if (fase === 'pillado') {
    sy = 0.88; sx = 1.08;                        // encogido/aplastado del susto
    tilt = Math.sin(t * 20) * 0.02;              // tiembla
  }

  const yBase = y - salto;
  sombraPie(ctx, x, y + 1, (ALTO_LADRON * 0.19) + salto * 0.25, 0.3);
  const ok = billboard(ctx, img, x, yBase, alto, { dir, sx, sy, tilt, alpha });
  if (!ok) fallbackLadron(ctx, x, yBase, s, dir);

  // efectos superpuestos (en coordenadas de pantalla, sin voltear)
  ctx.save();
  if (fase === 'recoger') chispas(ctx, x, yBase - alto * 0.55, t, s);
  if (fase === 'celebrar') { chispas(ctx, x - 10 * s, yBase - alto * 0.8, t, s); chispas(ctx, x + 10 * s, yBase - alto * 0.7, t + 1, s); }
  if (fase === 'pillado') {
    // gotas de sudor + estrellitas de mareo
    gota(ctx, x + dir * alto * 0.22, yBase - alto * 0.82, s, t);
    ctx.fillStyle = '#ffd84d';
    for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; estrella(ctx, x + Math.cos(a) * 12 * s, yBase - alto - 4 * s + Math.sin(a) * 4 * s, 3 * s); }
    if (extra.esposado) {
      ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.arc(x - 3 * s, yBase - alto * 0.42, 3 * s, 0, Math.PI * 2);
      ctx.arc(x + 3 * s, yBase - alto * 0.42, 3 * s, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

// Fallback si el sprite aun no ha cargado: silueta simple (no deberia verse en produccion).
function fallbackLadron(ctx, x, yBase, s, dir) {
  ctx.save(); ctx.translate(x, yBase); ctx.scale(dir, 1);
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.ellipse(0, -30 * s, 9 * s, 26 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6cfa8'; ctx.beginPath(); ctx.arc(0, -56 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Policia (sprite enfadado con esposas). dir hacia donde mira; opts.puno para agitar el puno.
export function dibujarPoli(ctx, x, y, s, dir, t, opts = {}) {
  const img = sprites.poli();
  const alto = ALTO_POLI;
  const bob = opts.corriendo ? Math.abs(Math.sin(t * 12)) * 3 * s : Math.sin(t * 3) * 1.2 * s;
  const tilt = opts.puno ? Math.sin(t * 10) * 0.05 : Math.sin(t * 2) * 0.01;
  sombraPie(ctx, x, y + 1, ALTO_POLI * 0.2, 0.3);
  const ok = billboard(ctx, img, x, y - bob, alto, { dir, tilt, sy: 1 + Math.abs(bob) * 0.004 });
  if (!ok) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#2f5fa8'; ctx.beginPath(); ctx.ellipse(0, -24 * s, 10 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
}

// Coche de policia entrando desde la calle con las luces barriendo la escena, y el poli al lado.
// po: {x, y, t, escapa, barrido}. wScene/hScene = tamano del lienzo en px de dibujo.
export function dibujarCochePoli(ctx, po, wScene, hScene, t, s) {
  po.barrido = Math.min(1, po.barrido + 0.015);
  // barrido de luces azul/rojo sobre toda la escena
  const alpha = (0.08 + 0.07 * Math.abs(Math.sin(t * 6))) * po.barrido;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = Math.sin(t * 6) > 0 ? '#3a60ff' : '#ff3030';
  ctx.fillRect(0, 0, wScene, hScene);
  ctx.restore();

  // el coche entra deslizando desde el borde hacia la entrada
  const img = sprites.coche();
  const entraDesde = po.escapa ? wScene + 60 : -60;
  const destino = po.x + (po.escapa ? 40 : -40);
  const cx = entraDesde + (destino - entraDesde) * easeOut(po.barrido);
  const cy = po.y - TILE * 0.2;
  const altoCoche = TILE * 2.0;
  if (img && img.complete && img.naturalWidth) {
    sombraPie(ctx, cx, cy + 2, altoCoche * 0.4, 0.28);
    billboard(ctx, img, cx, cy, altoCoche, { dir: po.escapa ? -1 : 1 });
  }
  // el poli saliendo junto a la entrada, dir mirando al museo
  const dir = po.escapa ? -1 : 1;
  const pvis = Math.max(0, (po.barrido - 0.35) / 0.65);
  if (pvis > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, pvis * 1.4);
    dibujarPoli(ctx, po.x + dir * TILE * 0.2, po.y, s, dir, t, { sirena: true, puno: po.escapa });
    ctx.restore();
  }
}

function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

function gota(ctx, x, y, s, t) {
  const dy = (Math.sin(t * 3) * 0.5 + 0.5) * 4 * s;
  ctx.fillStyle = '#7ec8ff'; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8 * s;
  ctx.beginPath(); ctx.moveTo(x, y - 3 * s + dy); ctx.quadraticCurveTo(x + 2 * s, y + dy, x, y + 2 * s + dy);
  ctx.quadraticCurveTo(x - 2 * s, y + dy, x, y - 3 * s + dy); ctx.fill(); ctx.stroke();
}

function chispas(ctx, x, y, t, s) {
  for (let i = 0; i < 4; i++) {
    const a = t * 5 + i * 1.6, r = (3 + (Math.sin(t * 4 + i) + 1) * 4) * s;
    ctx.fillStyle = i % 2 ? '#ffd84d' : '#fff2b0';
    estrella(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, (1.4 + Math.sin(t * 6 + i) * 0.6) * s);
  }
}

function estrella(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath(); ctx.fill();
}
