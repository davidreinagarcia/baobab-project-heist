// audio.js — efectos suaves. Primero intenta reproducir ficheros CC0 vendorizados (assets/sfx/);
// si no estan, sintetiza con WebAudio usando ondas senoidal/triangular, filtro paso bajo y
// envolvente lenta (nada de cuadrada/sierra). Volumen bajo. Silenciado por defecto.

let actx = null, silenciado = true;
const VOL = 0.35;
function ac() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }
export function setMute(m) { silenciado = m; if (!m && ac().resume) ac().resume(); }
export function isMute() { return silenciado; }

// Nota suave: oscilador senoidal/triangular -> filtro paso bajo -> envolvente lenta.
function nota(freq, dur, { tipo = 'sine', vol = 0.12, corte = 1800, retardo = 0 } = {}) {
  if (silenciado) return;
  const a = ac(); const t0 = a.currentTime + retardo;
  const o = a.createOscillator(); const g = a.createGain(); const lp = a.createBiquadFilter();
  o.type = tipo; o.frequency.setValueAtTime(freq, t0);
  lp.type = 'lowpass'; lp.frequency.value = corte;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * VOL, t0 + dur * 0.15);   // ataque suave
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);            // caida lenta
  o.connect(lp); lp.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// Sirena lejana suave (senoidal con vibrato, filtrada y a bajo volumen)
function sirenaSuave() {
  if (silenciado) return;
  const a = ac(); const t0 = a.currentTime;
  const o = a.createOscillator(); const g = a.createGain(); const lp = a.createBiquadFilter();
  o.type = 'sine'; lp.type = 'lowpass'; lp.frequency.value = 1200;
  o.frequency.setValueAtTime(600, t0);
  o.frequency.linearRampToValueAtTime(840, t0 + 0.5);
  o.frequency.linearRampToValueAtTime(600, t0 + 1.0);
  o.frequency.linearRampToValueAtTime(840, t0 + 1.5);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09 * VOL, t0 + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
  o.connect(lp); lp.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + 1.85);
}

export const sfx = {
  clic() { nota(420, 0.08, { tipo: 'sine', vol: 0.06, corte: 1500 }); },
  levantar() { nota(520, 0.12, { tipo: 'triangle', vol: 0.09, corte: 1600 }); },
  soltar() { nota(300, 0.12, { tipo: 'sine', vol: 0.1, corte: 1200 }); nota(200, 0.14, { tipo: 'sine', vol: 0.07, corte: 900, retardo: 0.04 }); },
  muro() { nota(240, 0.1, { tipo: 'triangle', vol: 0.08, corte: 1100 }); },
  recoger() { nota(660, 0.12, { tipo: 'sine', vol: 0.11 }); nota(990, 0.16, { tipo: 'sine', vol: 0.1, retardo: 0.07 }); },
  noCabe() { nota(180, 0.18, { tipo: 'triangle', vol: 0.1, corte: 700 }); },
  celebrar() { [523, 659, 784, 1046].forEach((f, i) => nota(f, 0.22, { tipo: 'triangle', vol: 0.1, retardo: i * 0.1 })); },
  sirena() { sirenaSuave(); },
  pillado() { nota(300, 0.3, { tipo: 'sine', vol: 0.12, corte: 900 }); nota(180, 0.45, { tipo: 'sine', vol: 0.11, corte: 700, retardo: 0.14 }); },
};
