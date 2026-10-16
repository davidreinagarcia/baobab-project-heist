// app.js — orquestador. Conecta motor + render + editor + simulacion + personajes + audio + UI.
// Modos: jugar (plan optimo / plan propio, arrastrar objetos) y construir (muros con preview).

import * as E from './engine.js';
import * as R from './render.js';
import * as P from './personajes.js';
import { Editor } from './editor.js';
import { Simulacion } from './simulacion.js';
import { sfx, setMute, isMute } from './audio.js';
import { precargar } from './sprites.js';
import { CATALOGO, CLAVES, fmtEuros, fmtCorto } from './catalogo.js';

const $ = s => document.querySelector(s);
const canvas = $('#stage'), ctx = canvas.getContext('2d');

// ---------- Estado ----------
const estado = {
  planoOriginal: null,    // plano del escenario base (para "restaurar")
  editor: null,           // fuente de verdad de la rejilla (muros + exterior)
  objetos: [],            // [[f,c], ...]
  tipos: [],              // clave del catalogo por objeto (su dibujo y su nombre)
  values: [], volumes: [],   // euros y kg, editables
  capacidad: 60, tiempo: 40, velocidad: 1, nObjetos: 10,
  modo: 'jugar',          // 'jugar' | 'construir'
  herramienta: 'anadir',  // construir: 'anadir' | 'quitar'
  modoPlan: 'optimo',     // 'optimo' | 'propio'
  resultado: null,        // ultimo planificar()
  caminoPropio: [],       // [[f,c], ...] camino dibujado por el jugador
  sim: null, rep: 1,
  poli: null, finEscena: null,
  recogiendoAnim: 0, flash: null,
};

// derivados de la rejilla
function plano() { return estado.editor.toStrings(); }
function esExterior(f, c) {
  // exterior = alcanzable desde el borde con la entrada cerrada, y no es muro
  if (estado._extCache && estado._extPlano === estado.editor) return estado._extCache.has(f + ',' + c);
  return estado.editor.exterior().has(f + ',' + c);
}
function refrescarExterior() { estado._extCache = estado.editor.exterior(); estado._extPlano = estado.editor; }

function activos() {
  return {
    objetos: estado.objetos.slice(0, estado.nObjetos),
    values: estado.values.slice(0, estado.nObjetos),
    volumes: estado.volumes.slice(0, estado.nObjetos),
  };
}

// ---------- Carga ----------
async function cargar() {
  const d = await (await fetch('data/escenario.json')).json();
  estado.planoOriginal = d.plano.slice();
  estado.editor = new Editor(d.plano);
  estado.objetos = d.objetos.map(o => [o.fila, o.col]);
  estado.tipos = d.objetos.map(o => o.tipo);
  estado.values = estado.tipos.map(t => CATALOGO[t].valor);
  estado.volumes = estado.tipos.map(t => CATALOGO[t].peso);
  estado.capacidad = d.parametros.capacidad;
  estado.tiempo = d.parametros.tiempo;
  estado.velocidad = d.parametros.velocidad;
  estado.nObjetos = estado.objetos.length;

  precargar();
  refrescarExterior();
  redimensionar();
  sincronizarControles();
  recalcular();
  construirListaObjetos();
  mostrarPistasIniciales();
  bucle();
}

// ---------- Planificar ----------
function recalcular() {
  const a = activos();
  estado.resultado = E.planificar(plano(), a.objetos, a.values, a.volumes,
    estado.capacidad, estado.tiempo, estado.velocidad);
  estado.resultado.objetos.forEach((o, i) => { o.spriteKey = estado.tipos[i]; o.nombre = CATALOGO[estado.tipos[i]].nombre; o.etiqueta = fmtCorto(estado.values[i]); });
  actualizarPanelPlan();
}

// solo filtra (capacidad/tiempo/velocidad): no recalcula el DP
function recalcularFiltro() {
  const a = activos(), res = estado.resultado;
  const g = E.elegirGolpe(res.rutas, a.values, a.volumes, estado.capacidad, estado.velocidad * estado.tiempo);
  const sinLim = E.elegirGolpe(res.rutas, a.values, a.volumes, estado.capacidad, Infinity);
  res.objetos.forEach((o, i) => o.cogido = g.orden.includes(i));
  res.valor_sin_limite_de_tiempo = sinLim.valor;
  const curva = []; const topeT = Number.isFinite(sinLim.distancia) ? Math.floor(sinLim.distancia / estado.velocidad) + 11 : 11;
  for (let t = 0; t < topeT; t += 5) { const gg = E.elegirGolpe(res.rutas, a.values, a.volumes, estado.capacidad, estado.velocidad * t); curva.push({ tiempo: t, valor: gg.valor, objetos: gg.orden.length }); }
  res.valor_segun_tiempo = curva;
  res.golpe = { orden: g.orden, ordenIdx: g.orden, valor: g.valor, volumen: g.volumen, distancia: g.distancia,
    tiempo: g.distancia / estado.velocidad, camino: E.caminoCompleto(plano(), a.objetos, g.orden).map(c => [c[0], c[1]]) };
  actualizarPanelPlan(); construirListaObjetos();
}

// plan actual (optimo o propio)
function planActual() {
  const res = estado.resultado;
  if (estado.modoPlan === 'optimo') {
    return { ordenIdx: res.golpe.ordenIdx, valor: res.golpe.valor, volumen: res.golpe.volumen,
      distancia: res.golpe.distancia, tiempo: res.golpe.tiempo, camino: res.golpe.camino,
      factible: Number.isFinite(res.golpe.distancia) };
  }
  // propio: a partir del camino dibujado
  return planDesdeCamino(estado.caminoPropio);
}

// Deriva valor/volumen/distancia/orden de un camino dibujado celda a celda.
function planDesdeCamino(camino) {
  const a = activos();
  const mapa = new Map(); a.objetos.forEach((o, i) => mapa.set(o[0] + ',' + o[1], i));
  let distancia = 0, volumen = 0, valor = 0;
  const ordenIdx = []; const recog = new Set();
  for (let i = 0; i < camino.length; i++) {
    if (i > 0) {
      const p = camino[i - 1], q = camino[i];
      distancia += (p[0] !== q[0] && p[1] !== q[1]) ? E.RAIZ2 : 1;
    }
    const k = camino[i][0] + ',' + camino[i][1];
    if (mapa.has(k) && !recog.has(mapa.get(k))) {
      const idx = mapa.get(k);
      if (volumen + a.volumes[idx] <= estado.capacidad) {
        recog.add(idx); ordenIdx.push(idx); volumen += a.volumes[idx]; valor += a.values[idx];
      }
    }
  }
  const vuelveSalida = camino.length > 1 &&
    camino[camino.length - 1][0] === estado.editor.entrada[0] &&
    camino[camino.length - 1][1] === estado.editor.entrada[1];
  return { ordenIdx, valor, volumen, distancia, tiempo: distancia / estado.velocidad,
    camino: camino.map(c => [c[0], c[1]]), factible: camino.length > 1, vuelveSalida };
}

// ---------- Panel ----------
function actualizarPanelPlan() {
  const res = estado.resultado, plan = planActual();
  const limite = estado.velocidad * estado.tiempo;
  const cabeTiempo = plan.factible && plan.distancia <= limite + 1e-9;
  const cabeMochila = plan.volumen <= estado.capacidad;
  const letras = plan.ordenIdx.map(i => res.objetos[i].nombre).join(' → ') || '(ninguno)';
  const tTxt = Number.isFinite(plan.tiempo) ? plan.tiempo.toFixed(1) : '∞';

  $('#resumen-plan').innerHTML = `
    <div class="linea">Ruta: puerta → ${letras} → puerta</div>
    <div class="linea">Botín: <b class="oro">${fmtEuros(plan.valor)} €</b></div>
    <div class="linea">Mochila: <b class="${cabeMochila ? '' : 'mal'}">${plan.volumen}/${estado.capacidad} kg</b></div>
    <div class="linea">Tiempo: <b class="${cabeTiempo ? 'bien' : 'mal'}">${tTxt}/${estado.tiempo} s</b></div>
    <div class="linea muted">Mejor posible: ${fmtEuros(res.golpe.valor)} €${estado.modoPlan === 'propio' && plan.valor < res.golpe.valor ? ` (te dejas ${fmtEuros(res.golpe.valor - plan.valor)})` : ''}</div>`;

  let aviso = '';
  const inalc = res.objetos.slice(0, estado.nObjetos).filter(o => !o.alcanzable);
  if (inalc.length) aviso += `<div class="aviso">${inalc.map(o => o.nombre).join(', ')}: no se puede alcanzar.</div>`;
  if (estado.modoPlan === 'propio' && plan.factible) {
    if (!cabeMochila) aviso += `<div class="aviso">No cabe todo en la mochila; lo que sobra se queda.</div>`;
    if (!cabeTiempo) aviso += `<div class="aviso">No da tiempo a volver: te pillaran.</div>`;
    if (!plan.vuelveSalida) aviso += `<div class="aviso">El camino no termina en la puerta: vuelve a la SALIDA.</div>`;
  }
  $('#aviso-plan').innerHTML = aviso;
  pintarHudEstatico(plan);
  dibujarCurva(res.valor_segun_tiempo, estado.tiempo);
}

function pintarHudEstatico(plan) {
  $('#hud-valor').innerHTML = `<svg class="ico oro"><use href="#i-bag"></use></svg> <b>0</b> €`;
  const rel = $('#peso-relleno'); rel.style.width = '0%'; rel.classList.remove('lleno');
  $('#peso-txt').textContent = `0/${estado.capacidad} kg`;
  $('#reloj').querySelector('b').textContent = estado.tiempo + 's';
  $('#reloj').classList.remove('peligro');
}

// Grafica botin/tiempo legible: ejes, etiquetas, marcador y hover
let curvaDatos = null, curvaGeom = null;
function dibujarCurva(curva, tiempoActual) {
  curvaDatos = curva;
  const c = $('#curva'); const g = c.getContext('2d');
  if (!c.clientWidth) return;   // pestaña oculta: se redibuja al volver (ResizeObserver)
  const W = c.width = c.clientWidth * devicePixelRatio, H = c.height = 150 * devicePixelRatio;
  g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const w = c.clientWidth, h = 150;
  g.clearRect(0, 0, w, h);
  if (!curva || !curva.length) return;
  const mL = 40, mR = 10, mT = 10, mB = 26;
  const maxT = Math.max(...curva.map(p => p.tiempo), 1);
  const maxV = Math.max(...curva.map(p => p.valor), 1);
  const X = t => mL + (t / maxT) * (w - mL - mR);
  const Y = v => h - mB - (v / maxV) * (h - mT - mB);
  curvaGeom = { mL, mR, mT, mB, maxT, maxV, w, h, X, Y };
  // ejes
  g.strokeStyle = '#4a5a7a'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(mL, mT); g.lineTo(mL, h - mB); g.lineTo(w - mR, h - mB); g.stroke();
  g.fillStyle = '#8fa3c8'; g.font = '9px Baloo'; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i <= 2; i++) { const v = maxV * i / 2; g.fillText(fmtCorto(v) + ' €', mL - 4, Y(v)); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 0; i <= 3; i++) { const t = maxT * i / 3; g.fillText(Math.round(t) + 's', X(t), h - mB + 4); }
  // area + linea
  const grd = g.createLinearGradient(0, mT, 0, h - mB);
  grd.addColorStop(0, 'rgba(255,206,58,.35)'); grd.addColorStop(1, 'rgba(255,206,58,0)');
  g.beginPath(); g.moveTo(X(0), Y(0));
  curva.forEach(p => g.lineTo(X(p.tiempo), Y(p.valor)));
  g.lineTo(X(curva[curva.length - 1].tiempo), Y(0)); g.closePath(); g.fillStyle = grd; g.fill();
  g.strokeStyle = '#ffce3a'; g.lineWidth = 2.5; g.lineJoin = 'round';
  g.beginPath(); curva.forEach((p, i) => i ? g.lineTo(X(p.tiempo), Y(p.valor)) : g.moveTo(X(p.tiempo), Y(p.valor))); g.stroke();
  // marcador del tiempo elegido
  const tx = X(Math.min(tiempoActual, maxT));
  g.strokeStyle = '#ff6a4a'; g.lineWidth = 2; g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(tx, mT); g.lineTo(tx, h - mB); g.stroke(); g.setLineDash([]);
  const vActual = valorEnTiempo(curva, tiempoActual);
  g.fillStyle = '#ff6a4a'; g.beginPath(); g.arc(tx, Y(vActual), 3.5, 0, Math.PI * 2); g.fill();
}
function valorEnTiempo(curva, t) {
  let v = 0; for (const p of curva) if (p.tiempo <= t) v = p.valor; return v;
}
new ResizeObserver(() => { if (curvaDatos) dibujarCurva(curvaDatos, estado.tiempo); }).observe($('#curva'));
$('#curva').addEventListener('mousemove', ev => {
  if (!curvaGeom || !curvaDatos) return;
  const r = ev.target.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const t = Math.max(0, Math.min(curvaGeom.maxT, (x - curvaGeom.mL) / (curvaGeom.w - curvaGeom.mL - curvaGeom.mR) * curvaGeom.maxT));
  const v = valorEnTiempo(curvaDatos, t);
  $('#curva-leyenda').textContent = `Con ${Math.round(t)} s tendrías ${fmtEuros(v)} € de botín.`;
});
$('#curva').addEventListener('mouseleave', () => { $('#curva-leyenda').textContent = 'Pasa el cursor por la gráfica para ver el botín a cada tiempo.'; });

// ---------- Lista de objetos ----------
function construirListaObjetos() {
  const cont = $('#obj-lista'); cont.innerHTML = '';
  const res = estado.resultado;
  for (let i = 0; i < estado.nObjetos; i++) {
    const o = res.objetos[i];
    const fila = document.createElement('div');
    fila.className = 'obj-fila' + (o.alcanzable ? '' : ' apagado');
    const opciones = CLAVES.map(k => `<option value="${k}"${k === estado.tipos[i] ? ' selected' : ''}>${CATALOGO[k].nombre}</option>`).join('');
    fila.innerHTML = `<img class="mini-sprite" src="assets/sprites/${estado.tipos[i]}.webp${window.__V ? '?v=' + window.__V : ''}" alt="">
      <select data-k="tipo" data-i="${i}" title="Objeto">${opciones}</select>
      <label title="Valor en euros"><span class="u">€</span><input type="number" data-k="valor" data-i="${i}" value="${estado.values[i]}" min="0" step="500"></label>
      <label title="Peso en kg"><span class="u">kg</span><input type="number" data-k="vol" data-i="${i}" value="${estado.volumes[i]}" min="1" step="1"></label>
      <span class="tag">${o.alcanzable ? '' : 'encerrado'}</span>`;
    cont.appendChild(fila);
  }
  cont.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, val = Math.max(0, +inp.value || 0);
      if (inp.dataset.k === 'valor') estado.values[i] = val; else estado.volumes[i] = Math.max(1, val);
      recalcular(); construirListaObjetos();
    });
  });
  cont.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.i, t = sel.value;
      estado.tipos[i] = t; estado.values[i] = CATALOGO[t].valor; estado.volumes[i] = CATALOGO[t].peso;
      recalcular(); construirListaObjetos();
    });
  });
}

// ---------- Controles ----------
function sincronizarControles() {
  $('#s-nobj').value = estado.nObjetos; $('#v-nobj').textContent = estado.nObjetos;
  $('#s-cap').value = estado.capacidad; $('#v-cap').textContent = estado.capacidad + ' kg';
  $('#s-tiempo').value = estado.tiempo; $('#v-tiempo').textContent = estado.tiempo;
  $('#s-vel').value = estado.velocidad; $('#v-vel').textContent = estado.velocidad;
}

function enlazarControles() {
  $('#s-nobj').addEventListener('input', e => { estado.nObjetos = +e.target.value; $('#v-nobj').textContent = estado.nObjetos; estado.caminoPropio = []; recalcular(); construirListaObjetos(); });
  $('#s-cap').addEventListener('input', e => { estado.capacidad = +e.target.value; $('#v-cap').textContent = estado.capacidad + ' kg'; recalcularFiltro(); });
  $('#s-tiempo').addEventListener('input', e => { estado.tiempo = +e.target.value; $('#v-tiempo').textContent = estado.tiempo; recalcularFiltro(); });
  $('#s-vel').addEventListener('input', e => { estado.velocidad = +e.target.value; $('#v-vel').textContent = estado.velocidad; recalcularFiltro(); });

  $('#btn-reset-valores').addEventListener('click', () => {
    estado.values = estado.tipos.map(t => CATALOGO[t].valor); estado.volumes = estado.tipos.map(t => CATALOGO[t].peso);
    recalcular(); construirListaObjetos(); sfx.clic();
  });
  $('#btn-barajar').addEventListener('click', () => {
    const azar = () => 0.5 + Math.random();
    for (let i = 0; i < estado.values.length; i++) {
      const c = CATALOGO[estado.tipos[i]];
      estado.values[i] = Math.round(c.valor * azar() / 500) * 500;
      estado.volumes[i] = Math.max(1, Math.round(c.peso * azar()));
    }
    recalcular(); construirListaObjetos(); sfx.clic();
  });

  $('#tab-jugar').addEventListener('click', () => cambiarModo('jugar'));
  $('#tab-construir').addEventListener('click', () => cambiarModo('construir'));

  $('#plan-optimo').addEventListener('click', () => { estado.modoPlan = 'optimo'; $('#plan-optimo').classList.add('sel'); $('#plan-propio').classList.remove('sel'); $('#propio-controles').style.display = 'none'; actualizarPanelPlan(); sfx.clic(); });
  $('#plan-propio').addEventListener('click', () => { estado.modoPlan = 'propio'; $('#plan-propio').classList.add('sel'); $('#plan-optimo').classList.remove('sel'); $('#propio-controles').style.display = ''; actualizarPanelPlan(); sfx.clic(); });
  $('#btn-copiar-optimo').addEventListener('click', () => { estado.caminoPropio = estado.resultado.golpe.camino.map(c => c.slice()); actualizarPanelPlan(); sfx.clic(); });
  $('#btn-deshacer-tramo').addEventListener('click', () => { deshacerTramoPropio(); sfx.clic(); });
  $('#btn-borrar-camino').addEventListener('click', () => { estado.caminoPropio = []; actualizarPanelPlan(); sfx.clic(); });

  $('#btn-run').addEventListener('click', ejecutarGolpe);
  $('#btn-reset').addEventListener('click', reiniciar);
  document.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => {
    estado.rep = +b.dataset.rep; document.querySelectorAll('[data-rep]').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    if (estado.sim) estado.sim.setRep(estado.rep); sfx.clic();
  }));

  $('#btn-mute').addEventListener('click', () => { const m = !isMute(); setMute(m); $('#btn-mute').querySelector('use').setAttribute('href', m ? '#i-mute' : '#i-sound'); });

  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); estado.herramienta = b.dataset.tool; sfx.clic();
  }));
  $('#btn-deshacer').addEventListener('click', () => { if (estado.editor.deshacer()) aplicarEdicion(); sfx.clic(); });
  $('#btn-rehacer').addEventListener('click', () => { if (estado.editor.rehacer()) aplicarEdicion(); sfx.clic(); });
  $('#btn-restaurar').addEventListener('click', () => { estado.editor.restaurar(estado.planoOriginal); aplicarEdicion(); sfx.clic(); });
}

function cambiarModo(m) {
  estado.modo = m; pararGolpe();
  $('#modo-jugar').style.display = m === 'jugar' ? '' : 'none';
  $('#modo-construir').style.display = m === 'construir' ? '' : 'none';
  $('#tab-jugar').classList.toggle('sel', m === 'jugar');
  $('#tab-construir').classList.toggle('sel', m === 'construir');
  $('.acciones') && (document.querySelector('.acciones').style.visibility = m === 'jugar' ? 'visible' : 'hidden');
  sfx.clic();
}

// ---------- Edicion (construir) ----------
function aplicarEdicion() {
  refrescarExterior();
  reubicarObjetosFueraDeSuelo();
  recalcular(); construirListaObjetos();
  $('#btn-deshacer').disabled = !estado.editor.puedeDeshacer();
  $('#btn-rehacer').disabled = !estado.editor.puedeRehacer();
}
function reubicarObjetosFueraDeSuelo() {
  let movidos = 0;
  for (let i = 0; i < estado.objetos.length; i++) {
    const [f, c] = estado.objetos[i];
    if (!estado.editor.esSuelo(f, c)) {
      const libre = celdaSueloLibreCercana(f, c);
      if (libre) { estado.objetos[i] = libre; movidos++; }
    }
  }
  if (movidos) flashAviso(`${movidos} objeto${movidos > 1 ? 's' : ''} recolocado${movidos > 1 ? 's' : ''}`);
}
function celdaSueloLibreCercana(f, c) {
  const ocupadas = new Set(estado.objetos.map((o, i) => o[0] + ',' + o[1]));
  const ent = estado.editor.entrada;
  for (let r = 0; r < 12; r++) for (let df = -r; df <= r; df++) for (let dc = -r; dc <= r; dc++) {
    const nf = f + df, nc = c + dc; const k = nf + ',' + nc;
    if (estado.editor.esSuelo(nf, nc) && !ocupadas.has(k) && !(nf === ent[0] && nc === ent[1])) return [nf, nc];
  }
  return null;
}

// ---------- Simulacion ----------
function ejecutarGolpe() {
  if (estado.modo !== 'jugar') return;
  const plan = planActual();
  if (!plan.camino || plan.camino.length < 2) { flashAviso('Primero elige o dibuja un plan'); return; }
  pararGolpe();
  estado.finEscena = null; estado.poli = null; $('#cartel').classList.remove('show'); $('#cartel-stats').classList.remove('show');
  botonPressed('#btn-run');
  estado.sim = new Simulacion({
    plano: plano(), camino: plan.camino, objetos: estado.resultado.objetos,
    ordenIdx: plan.ordenIdx, pasosPorSeg: estado.velocidad, tiempoLimite: estado.tiempo,
    capacidad: estado.capacidad, rep: estado.rep,
    on: {
      recoger: () => { sfx.recoger(); estado.recogiendoAnim = 0.4; },
      noCabe: () => { sfx.noCabe(); flashAviso('No cabe en la mochila'); },
      avisoPoli: () => { sfx.sirena(); lanzarPoli(); },
      tick: info => pintarHud(info),
      fin: resultado => finalizar(resultado),
    },
  });
  estado.sim.play();
}
function pararGolpe() {
  if (estado.sim) { estado.sim.pause(); estado.sim = null; }
  estado.finEscena = null; estado.poli = null; estado.recogiendoAnim = 0;
  $('#cartel').classList.remove('show'); $('#cartel-stats').classList.remove('show');
}
// REINICIAR: reloj a 0, posicion ladron, recogidos, mochila, poli, pantalla final, estado sim.
// Mantiene museo, objetos y ajustes.
function reiniciar() {
  botonPressed('#btn-reset');
  pararGolpe();
  recalcular();
  sfx.clic();
}

function finalizar(resultado) {
  estado.finEscena = resultado.escapa ? 'huida' : 'pillado';
  if (resultado.escapa) { sfx.celebrar(); mostrarCartel('¡ESCAPADO!', false); }
  else { sfx.pillado(); mostrarCartel('¡PILLADO!', true); mostrarBocadillo('¡NI-NO-NI-NO!'); }
  lanzarPoli(resultado.escapa);
  mostrarMetricas(resultado);
}
function mostrarMetricas(r) {
  const optimo = estado.resultado.golpe.valor, st = $('#cartel-stats');
  if (r.escapa) {
    const sufijo = r.valor >= optimo ? ' — ¡Óptimo conseguido!' : '';
    st.innerHTML = `<span class="valor-gordo">${fmtEuros(r.valor)} €</span>` +
      `<span class="optimo-txt">Óptimo posible: ${fmtEuros(optimo)} €${sufijo}</span>`;
  } else {
    st.innerHTML = `Botín perdido: <b class="mal">${fmtEuros(r.valor)} €</b><br>Óptimo posible: <b>${fmtEuros(optimo)} €</b><br>Te ha faltado tiempo para volver`;
  }
  st.classList.remove('show'); void st.offsetWidth; st.classList.add('show');
}
function mostrarCartel(texto, pillado) {
  $('#bocadillo').classList.remove('show');
  const t = $('#cartel-texto'); t.textContent = texto; t.className = 'texto' + (pillado ? ' pillado' : '');
  $('#cartel').classList.remove('show'); void $('#cartel').offsetWidth; $('#cartel').classList.add('show');
}
function mostrarBocadillo(texto) { const b = $('#bocadillo'); b.textContent = texto; b.classList.add('show'); }
function lanzarPoli(escapa) {
  const ent = estado.editor.entrada; const c = R.celdaACentro(ent[0], ent[1]);
  estado.poli = { x: c.x, y: c.y, t: 0, escapa, barrido: 0 };
}

// ---------- HUD en vivo ----------
function pintarHud(info) {
  $('#hud-valor').innerHTML = `<svg class="ico oro"><use href="#i-bag"></use></svg> <b>${fmtEuros(info.valor)}</b> €`;
  const pct = estado.capacidad > 0 ? Math.min(100, info.volumen / estado.capacidad * 100) : 0;
  const rel = $('#peso-relleno'); rel.style.width = pct + '%'; rel.classList.toggle('lleno', pct >= 100);
  $('#peso-txt').textContent = `${info.volumen}/${estado.capacidad} kg`;
  const reloj = $('#reloj'); reloj.querySelector('b').textContent = Math.ceil(info.restante) + 's';
  reloj.classList.toggle('peligro', info.restante <= 5);
}

// ---------- Interaccion con el lienzo (pointer + tactil) ----------
let gesto = null; // {tipo, inicio:[f,c], actual:[f,c], ...}
function pxDesdeEvento(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (canvas.width / r.width) / devicePixelRatio,
           y: (ev.clientY - r.top) * (canvas.height / r.height) / devicePixelRatio };
}
function objetoEn(x, y) {
  for (let i = estado.nObjetos - 1; i >= 0; i--) {
    const cc = R.celdaABase(estado.objetos[i][0], estado.objetos[i][1]);
    if (Math.abs(cc.x - x) < R.TILE * 0.5 && cc.y - y > -R.TILE * 0.2 && cc.y - y < R.TILE * 1.3) return i;
  }
  return -1;
}

function enlazarCanvas() {
  canvas.addEventListener('pointerdown', ev => {
    if (estado.sim) return;
    ev.preventDefault();
    const { x, y } = pxDesdeEvento(ev);
    const celda = R.pxACelda(x, y, plano());
    try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    if (estado.modo === 'construir') {
      if (!celda) return;
      gesto = { tipo: 'muro', inicio: celda, actual: celda, pid: ev.pointerId };
    } else if (estado.modoPlan === 'propio') {
      // dibujar camino: empezar en la entrada si el camino esta vacio
      if (!celda) return;
      gesto = { tipo: 'camino', pid: ev.pointerId };
      if (!estado.caminoPropio.length) estado.caminoPropio = [estado.editor.entrada.slice()];
      extenderCaminoPropio(celda);
    } else {
      const i = objetoEn(x, y);
      if (i >= 0) {
        gesto = { tipo: 'arrastre', idx: i, origen: estado.objetos[i].slice(), destino: celda, pid: ev.pointerId, lift: 0 };
        sfx.levantar();
      }
    }
  });

  canvas.addEventListener('pointermove', ev => {
    const { x, y } = pxDesdeEvento(ev);
    const celda = R.pxACelda(x, y, plano());
    estado.celdaCursor = (estado.modo === 'construir') ? celda : null;
    estado.hoverIdx = (estado.modo === 'jugar' && !estado.sim && !gesto) ? objetoEn(x, y) : -1;
    if (!gesto) return;
    if (gesto.tipo === 'muro') { if (celda) gesto.actual = celda; }
    else if (gesto.tipo === 'camino') { if (celda) extenderCaminoPropio(celda); }
    else if (gesto.tipo === 'arrastre') { gesto.destino = celda; gesto.px = { x, y }; }
  });

  const soltar = ev => {
    if (!gesto) return;
    if (gesto.tipo === 'muro') aplicarGestoMuro(gesto);
    else if (gesto.tipo === 'arrastre') soltarArrastre(gesto);
    else if (gesto.tipo === 'camino') { actualizarPanelPlan(); }
    gesto = null;
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', () => { gesto = null; });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { gesto = null; } });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); gesto = null; });
}

function aplicarGestoMuro(g) {
  const esClick = g.inicio[0] === g.actual[0] && g.inicio[1] === g.actual[1];
  const modo = estado.herramienta; // 'anadir' | 'quitar'
  let celdasAfectadas;
  if (esClick) celdasAfectadas = [g.inicio];                      // un click: 1 celda
  else if (modo === 'anadir') celdasAfectadas = estado.editor.perimetroRect(g.inicio, g.actual);
  else celdasAfectadas = estado.editor.interiorRect(g.inicio, g.actual);
  const ok = estado.editor.aplicar(modo, celdasAfectadas);
  if (!ok) { flashAviso('Esa edicion dejaria el museo sin suelo'); return; }
  sfx.muro();
  aplicarEdicion();
}

function soltarArrastre(g) {
  const i = g.idx, destino = g.destino;
  const valido = destinoValido(destino, i);
  if (valido) {
    estado.objetos[i] = destino.slice();
    estado.caeAnim = { idx: i, t: 0.35 };
    sfx.soltar();
    estado.caminoPropio = []; // el camino propio deja de ser valido al mover objetos
    recalcular(); construirListaObjetos();
  } else {
    // vuelve a su celda anterior (la animacion de "volver" se hace en el bucle)
    estado.objetos[i] = g.origen.slice();
    sfx.noCabe();
    recalcular();
  }
}
function destinoValido(celda, idx) {
  if (!celda) return false;
  if (!estado.editor.esSuelo(celda[0], celda[1])) return false;
  if (celda[0] === estado.editor.entrada[0] && celda[1] === estado.editor.entrada[1]) return false;
  for (let i = 0; i < estado.nObjetos; i++) if (i !== idx && estado.objetos[i][0] === celda[0] && estado.objetos[i][1] === celda[1]) return false;
  return true;
}

// ---------- Camino propio ----------
function extenderCaminoPropio(celda) {
  const cp = estado.caminoPropio;
  if (!cp.length) { cp.push(celda.slice()); return; }
  const ult = cp[cp.length - 1];
  if (ult[0] === celda[0] && ult[1] === celda[1]) return;
  // retroceso: si la nueva celda es la penultima, acorta
  if (cp.length >= 2) { const pen = cp[cp.length - 2]; if (pen[0] === celda[0] && pen[1] === celda[1]) { cp.pop(); actualizarPanelPlan(); return; } }
  // conectar por pasos adyacentes (8 dir) validos; si estan lejos, rellenar con pasos simples
  const pasos = pasosEntre(ult, celda);
  for (const p of pasos) {
    const prev = cp[cp.length - 1];
    if (prev[0] === p[0] && prev[1] === p[1]) continue;
    if (!pasoValido(prev, p)) break;
    cp.push(p.slice());
  }
  actualizarPanelPlan();
}
// serie de celdas de `a` a `b` moviendose de a 1 celda (8 dir), tipo linea
function pasosEntre(a, b) {
  const out = []; let [f, c] = a;
  while (f !== b[0] || c !== b[1]) {
    f += Math.sign(b[0] - f); c += Math.sign(b[1] - c); out.push([f, c]);
    if (out.length > 200) break;
  }
  return out;
}
function pasoValido(a, b) {
  const df = b[0] - a[0], dc = b[1] - a[1];
  if (Math.abs(df) > 1 || Math.abs(dc) > 1) return false;
  if (!estado.editor.esSuelo(b[0], b[1])) return false;
  if (df !== 0 && dc !== 0) { // diagonal: no cortar esquinas
    if (!(estado.editor.esSuelo(a[0] + df, a[1]) && estado.editor.esSuelo(a[0], a[1] + dc))) return false;
  }
  return true;
}
function deshacerTramoPropio() {
  // quita el ultimo "tramo recto" (hasta el ultimo cambio de direccion o un objeto)
  const cp = estado.caminoPropio;
  if (cp.length <= 1) { estado.caminoPropio = []; actualizarPanelPlan(); return; }
  cp.pop();
  actualizarPanelPlan();
}

// ---------- Avisos / botones ----------
let flashTimer = 0, flashTexto = '';
function flashAviso(t) { flashTexto = t; flashTimer = 2.2; }
function botonPressed(sel) { const b = $(sel); b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 150); }

// ---------- Pistas iniciales ----------
function mostrarPistasIniciales() {
  if (localStorage.getItem('heist-pistas-v2')) return;
  const pistas = [
    'Elige "Plan optimo" para ver el mejor atraco posible.',
    'Arrastra los objetos por el museo para recolocarlos.',
    'Pulsa PLAY y mira si el ladron escapa a tiempo.',
  ];
  const cont = $('#pistas');
  pistas.forEach((txt, i) => {
    const g = document.createElement('div'); g.className = 'globo'; g.style.animationDelay = (i * 0.15) + 's';
    g.innerHTML = `${txt} <button aria-label="Cerrar" class="cerrar-globo">&times;</button>`;
    g.querySelector('button').addEventListener('click', () => { g.remove(); if (!cont.children.length) localStorage.setItem('heist-pistas-v2', '1'); });
    cont.appendChild(g);
  });
}

// ---------- Redimensionado ----------
function redimensionar() {
  const d = R.dimsCanvas(plano());
  canvas.width = d.w * devicePixelRatio; canvas.height = d.h * devicePixelRatio;
  const wrap = $('#stage-wrap');
  const escala = Math.min(wrap.clientWidth / d.w, wrap.clientHeight / d.h, 2.4);
  canvas.style.width = d.w * escala + 'px'; canvas.style.height = d.h * escala + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', () => redimensionar());

// ---------- Bucle de dibujo ----------
let ultimo = performance.now();
function bucle() {
  const ahora = performance.now(); const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
  const t = ahora / 1000;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  if (estado.recogiendoAnim > 0) estado.recogiendoAnim -= dt;
  if (estado.caeAnim) { estado.caeAnim.t -= dt; if (estado.caeAnim.t <= 0) estado.caeAnim = null; }
  if (estado.sim) estado.sim.update(dt);

  const pl = plano();
  const plan = estado.sim ? null : planActual();
  const resaltar = (estado.modo === 'jugar' && !estado.sim && estado.modoPlan === 'optimo')
    ? new Set(plan.ordenIdx.filter(i => i < estado.nObjetos)) : null;

  // preview de muro en construir
  let preview = null, previewModo = estado.herramienta;
  if (estado.modo === 'construir' && gesto && gesto.tipo === 'muro') {
    const esClick = gesto.inicio[0] === gesto.actual[0] && gesto.inicio[1] === gesto.actual[1];
    preview = esClick ? [gesto.inicio] : (estado.herramienta === 'anadir'
      ? estado.editor.perimetroRect(gesto.inicio, gesto.actual) : estado.editor.interiorRect(gesto.inicio, gesto.actual));
  }

  R.dibujarEscena(ctx, {
    plano: pl, entrada: estado.editor.entrada,
    objetos: estado.resultado.objetos.slice(0, estado.nObjetos),
    camino: estado.sim ? estado.sim.camino : (estado.modoPlan === 'optimo' && !estado.sim && plan ? plan.camino : null),
    progresoCamino: estado.sim ? estado.sim.progreso() : 1,
    recogidos: estado.sim ? estado.sim.recogidos : null,
    resaltar, esExterior, construir: estado.modo === 'construir',
    celdaCursor: estado.modo === 'construir' ? estado.celdaCursor : null,
    preview, previewModo,
    caminoPropio: (estado.modo === 'jugar' && estado.modoPlan === 'propio' && !estado.sim) ? estado.caminoPropio : null,
    arrastrando: gesto && gesto.tipo === 'arrastre' ? gesto.idx : -1,
    t,
  });

  // objeto que se arrastra (encima de todo)
  if (gesto && gesto.tipo === 'arrastre' && gesto.px) {
    const o = estado.resultado.objetos[gesto.idx];
    const bal = Math.sin(t * 8) * 2;
    R.dibujarMarcadorDestino(ctx, gesto.destino, destinoValido(gesto.destino, gesto.idx));
    R.dibujarObjetoFlotante(ctx, o, gesto.idx, { x: gesto.px.x + bal, y: gesto.px.y }, t);
  }

  // etiqueta con el nombre del objeto bajo el cursor
  if (estado.hoverIdx >= 0 && estado.hoverIdx < estado.nObjetos && !gesto) {
    const i = estado.hoverIdx, o = estado.resultado.objetos[i];
    const b = R.celdaABase(o.fila, o.col), txt = `${o.nombre} · ${fmtEuros(estado.values[i])} € · ${estado.volumes[i]} kg`;
    ctx.save(); ctx.font = 'bold 11px Baloo'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 14, x = Math.max(w / 2 + 2, Math.min(canvas.width / devicePixelRatio - w / 2 - 2, b.x)), y = b.y - R.TILE * 1.7;
    ctx.fillStyle = 'rgba(16,25,46,.95)'; ctx.strokeStyle = '#ffce3a'; ctx.lineWidth = 1.5;
    R.roundRect(ctx, x - w / 2, y - 10, w, 20, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y + 0.5); ctx.restore();
  }

  // personaje principal (ladron)
  const s = R.TILE / 40;
  if (estado.sim) {
    const pos = estado.sim.posicion(); const dir = estado.sim.direccion();
    const total = Math.max(1, estado.sim.ordenIdx.length);
    const bolsa = estado.sim.recogidos.size / total;
    let fase = 'andar', p = (t * 4) % 1;
    if (estado.finEscena === 'huida') fase = 'celebrar';
    else if (estado.finEscena === 'pillado') fase = 'pillado';
    else if (estado.recogiendoAnim > 0) fase = 'recoger';
    P.dibujarLadron(ctx, pos.x, pos.y + R.TILE * 0.3, s, dir, fase, t, p, { bolsa, prog: 1 - estado.recogiendoAnim / 0.4, esposado: estado.finEscena === 'pillado' });
    R.dibujarMurosDelante(ctx, pl, esExterior, pos.x, pos.y + R.TILE * 0.3);
  } else if (estado.modo === 'jugar') {
    const ent = estado.editor.entrada; const c = R.celdaACentro(ent[0], ent[1]);
    P.dibujarLadron(ctx, c.x, c.y + R.TILE * 0.3, s, 1, 'idle', t, 0, { bolsa: 0 });
    R.dibujarMurosDelante(ctx, pl, esExterior, c.x, c.y + R.TILE * 0.3);
  }

  // policia / coche al final
  if (estado.poli) {
    const po = estado.poli; po.t += dt;
    P.dibujarCochePoli(ctx, po, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio, t, s);
  }

  // aviso flotante
  if (flashTimer > 0) {
    flashTimer -= dt;
    ctx.save(); ctx.globalAlpha = Math.min(1, flashTimer); ctx.textAlign = 'center';
    ctx.font = `${R.TILE * 0.55}px Bangers`; ctx.fillStyle = '#ffce3a'; ctx.strokeStyle = '#0c1220'; ctx.lineWidth = 4;
    const cx = canvas.width / devicePixelRatio / 2;
    ctx.strokeText(flashTexto, cx, 34); ctx.fillText(flashTexto, cx, 34); ctx.restore();
  }

  requestAnimationFrame(bucle);
}

// Hook de depuracion para pruebas automatizadas (inofensivo en produccion).
window.__heist = { estado, R, celdaABase: R.celdaABase };

// ---------- Arranque ----------
enlazarControles(); enlazarCanvas();
cargar().catch(err => { document.body.innerHTML = '<p style="padding:20px;color:#fff">Error al cargar: ' + err.message + '</p>'; console.error(err); });
