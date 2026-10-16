// editor.js — modelo de construccion simple: solo "muro" y "suelo". La rejilla es una matriz de
// booleanos (muro si/no). La entrada/salida es fija y nunca se tapia.
//
// Regla clave de suelo: todo lo RODEADO de muros es suelo interior; lo que se alcanza desde el
// borde del tablero (sin cruzar muros, tratando la entrada como cerrada) es EXTERIOR (calle,
// no transitable). Asi el jugador "cierra" salas y el interior se rellena solo.
//
// El motor sigue viendo '#'/'.'/'E': toStrings() mapea exterior -> '#' (bloqueado) e interior -> '.'.
// render.js distingue muro de exterior con claseCelda().
//
// Escrito a mano: la rejilla es 40x17 y el modelo (flood fill + rectangulos) es muy pequeno;
// un editor de tilemap externo obligaria a adaptar formato y peso sin ganar nada.

export const MURO = 1, SUELO = 0;

export class Editor {
  // plano: array de strings del motor ('#','.','E'). Deriva: muro[][] y la entrada fija.
  constructor(plano) {
    this.filas = plano.length;
    this.cols = plano[0].length;
    this.muro = plano.map(f => [...f].map(ch => ch === '#' ? MURO : SUELO));
    this.entrada = this._buscarEntrada(plano);
    this.pila = [];        // historial para deshacer (snapshots de this.muro)
    this.rehacerPila = [];
  }

  _buscarEntrada(plano) {
    for (let f = 0; f < plano.length; f++) {
      const c = plano[f].indexOf('E');
      if (c !== -1) return [f, c];
    }
    return [plano.length - 1, 0];
  }

  esEntrada(f, c) { return f === this.entrada[0] && c === this.entrada[1]; }
  dentro(f, c) { return f >= 0 && f < this.filas && c >= 0 && c < this.cols; }
  esBorde(f, c) { return f === 0 || c === 0 || f === this.filas - 1 || c === this.cols - 1; }

  _clon() { return this.muro.map(fila => fila.slice()); }
  snapshot() {
    this.pila.push(this._clon());
    if (this.pila.length > 80) this.pila.shift();
    this.rehacerPila = [];
  }
  deshacer() {
    if (!this.pila.length) return false;
    this.rehacerPila.push(this._clon());
    this.muro = this.pila.pop();
    return true;
  }
  rehacer() {
    if (!this.rehacerPila.length) return false;
    this.pila.push(this._clon());
    this.muro = this.rehacerPila.pop();
    return true;
  }
  puedeDeshacer() { return this.pila.length > 0; }
  puedeRehacer() { return this.rehacerPila.length > 0; }

  // ---- Flood fill desde el borde sobre celdas sin muro, con la entrada CERRADA. Lo alcanzado
  // es exterior (calle). Devuelve Set de claves "f,c" exteriores.
  exterior() {
    const ext = new Set();
    const k = (f, c) => f + ',' + c;
    const pila = [];
    const empujar = (f, c) => {
      if (!this.dentro(f, c) || ext.has(k(f, c))) return;
      if (this.muro[f][c] === MURO) return;
      if (this.esEntrada(f, c)) return;   // la entrada actua como cerrada en este calculo
      ext.add(k(f, c)); pila.push([f, c]);
    };
    for (let c = 0; c < this.cols; c++) { empujar(0, c); empujar(this.filas - 1, c); }
    for (let f = 0; f < this.filas; f++) { empujar(f, 0); empujar(f, this.cols - 1); }
    while (pila.length) {
      const [f, c] = pila.pop();
      empujar(f - 1, c); empujar(f + 1, c); empujar(f, c - 1); empujar(f, c + 1);
    }
    return ext;
  }

  // Celdas de suelo interior transitables (ni muro, ni exterior; la entrada siempre cuenta).
  celdasSuelo() {
    const ext = this.exterior();
    const suelo = [];
    for (let f = 0; f < this.filas; f++) for (let c = 0; c < this.cols; c++) {
      if (this.esEntrada(f, c)) { suelo.push([f, c]); continue; }
      if (this.muro[f][c] === MURO) continue;
      if (ext.has(f + ',' + c)) continue;
      suelo.push([f, c]);
    }
    return suelo;
  }
  esSuelo(f, c) {
    if (!this.dentro(f, c)) return false;
    if (this.esEntrada(f, c)) return true;
    if (this.muro[f][c] === MURO) return false;
    return !this.exterior().has(f + ',' + c);
  }

  // ---- Rectangulo: solo el perimetro (como "cuadrados"). Si a==b es una sola celda.
  perimetroRect(a, b) {
    const f0 = Math.min(a[0], b[0]), f1 = Math.max(a[0], b[0]);
    const c0 = Math.min(a[1], b[1]), c1 = Math.max(a[1], b[1]);
    const celdas = [];
    for (let c = c0; c <= c1; c++) { celdas.push([f0, c]); if (f1 !== f0) celdas.push([f1, c]); }
    for (let f = f0 + 1; f < f1; f++) { celdas.push([f, c0]); if (c1 !== c0) celdas.push([f, c1]); }
    return celdas;
  }
  // Interior del rectangulo (para la herramienta "quitar" por arrastre).
  interiorRect(a, b) {
    const f0 = Math.min(a[0], b[0]), f1 = Math.max(a[0], b[0]);
    const c0 = Math.min(a[1], b[1]), c1 = Math.max(a[1], b[1]);
    const celdas = [];
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) celdas.push([f, c]);
    return celdas;
  }

  // Preview de celdas afectadas por la herramienta (para dibujar translucido antes de soltar).
  // modo: 'anadir' (perimetro del rect) | 'quitar' (rect lleno). a..b son celdas; si iguales, 1 celda.
  preview(modo, a, b) {
    if (modo === 'anadir') return this.perimetroRect(a, b);
    return this.interiorRect(a, b);
  }

  // Aplicar: devuelve false si la edicion dejaria el museo sin suelo suficiente (se rechaza).
  aplicar(modo, celdas) {
    const nuevo = this._clon();
    for (const [f, c] of celdas) {
      if (!this.dentro(f, c)) continue;
      if (this.esEntrada(f, c)) continue;      // la entrada no se tapia
      if (this.esBorde(f, c) && modo === 'quitar') continue; // el perimetro exterior no se abre
      nuevo[f][c] = modo === 'anadir' ? MURO : SUELO;
    }
    // validar que queda al menos la entrada como suelo (siempre lo es) y algo de sitio
    const antes = this.muro; this.muro = nuevo;
    const suelo = this.celdasSuelo();
    if (suelo.length < 1) { this.muro = antes; return false; }
    this.muro = antes; // deshacer el toqueteo temporal
    this.snapshot();
    this.muro = nuevo;
    return true;
  }

  restaurar(planoOriginal) {
    this.snapshot();
    this.muro = planoOriginal.map(f => [...f].map(ch => ch === '#' ? MURO : SUELO));
    this.entrada = this._buscarEntrada(planoOriginal);
  }

  // Plano para el motor: exterior y muro -> '#', suelo -> '.', entrada -> 'E'.
  toStrings() {
    const ext = this.exterior();
    const out = [];
    for (let f = 0; f < this.filas; f++) {
      let fila = '';
      for (let c = 0; c < this.cols; c++) {
        if (this.esEntrada(f, c)) fila += 'E';
        else if (this.muro[f][c] === MURO || ext.has(f + ',' + c)) fila += '#';
        else fila += '.';
      }
      out.push(fila);
    }
    return out;
  }
}
