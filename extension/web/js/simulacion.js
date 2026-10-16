// simulacion.js — reproduce el recorrido celda a celda con velocidad constante. Un paso diagonal
// tarda sqrt(2) veces mas que uno ortogonal (misma velocidad lineal). Controla pausa, rep (x1/x2/x4)
// y el reloj de la policia. Avisa al orquestador: recoger, aviso de poli, fin.
//
// El camino viene del motor (lista de celdas entrada->objetos->entrada). La recogida de objetos es
// automatica al pisar su celda si cabe en la mochila; si no cabe, se avisa y no se recoge.

import { celdaACentro } from './render.js';

const DIAG = Math.SQRT2;

export class Simulacion {
  constructor(opts) {
    this.plano = opts.plano;
    this.camino = opts.camino;            // [[f,c], ...]
    this.objetos = opts.objetos;          // lista del motor (con valor/volumen)
    this.ordenIdx = opts.ordenIdx || [];  // indices que el plan pretende recoger
    this.pasosPorSeg = opts.pasosPorSeg;  // celdas ortogonales por segundo (velocidad constante)
    this.tiempoLimite = opts.tiempoLimite;
    this.capacidad = opts.capacidad;
    this.rep = opts.rep || 1;
    this.on = opts.on || {};

    this.celdaActual = 0;
    this.frac = 0;                        // 0..1 dentro del tramo actual
    this.recogidos = new Set();
    this.volumenActual = 0;
    this.valorActual = 0;
    this.tiempoJuego = 0;
    this.corriendo = false;
    this.terminado = false;
    this.avisoPoli = false;
    this._pos = this.camino.length ? celdaACentro(...this.camino[0]) : { x: 0, y: 0 };
    this.dir = 1;
    // longitud total en "celdas ortogonales equivalentes" para el progreso
    this.longitudTotal = 0;
    for (let i = 0; i < this.camino.length - 1; i++) this.longitudTotal += this._coste(i);
    // mapa celda -> indice de objeto (para recogida automatica al pisar)
    this.celdaObjeto = new Map();
    this.objetos.forEach((o, i) => this.celdaObjeto.set(o.fila + ',' + o.col, i));
    this.distRecorrida = 0;
  }

  _coste(i) {
    const a = this.camino[i], b = this.camino[i + 1];
    return (a[0] !== b[0] && a[1] !== b[1]) ? DIAG : 1;
  }

  play() { this.corriendo = true; }
  pause() { this.corriendo = false; }
  setRep(r) { this.rep = r; }
  posicion() { return this._pos; }
  direccion() { return this.dir; }
  progreso() { return this.longitudTotal <= 0 ? 1 : Math.min(1, this.distRecorrida / this.longitudTotal); }

  update(dt) {
    if (!this.corriendo || this.terminado) return;
    const dtJuego = dt * this.rep;
    this.tiempoJuego += dtJuego;
    const avance = this.pasosPorSeg * dtJuego;  // celdas ortogonales equivalentes este frame

    if (!this.avisoPoli && this.tiempoLimite > 0 && this.tiempoJuego >= this.tiempoLimite - 3) {
      this.avisoPoli = true; this.on.avisoPoli && this.on.avisoPoli();
    }

    if (this.celdaActual < this.camino.length - 1) {
      let restante = avance;
      while (restante > 0 && this.celdaActual < this.camino.length - 1) {
        const coste = this._coste(this.celdaActual);
        const quedaTramo = (1 - this.frac) * coste;
        if (restante >= quedaTramo) {
          restante -= quedaTramo;
          this.distRecorrida += quedaTramo;
          this.celdaActual++; this.frac = 0;
          this._llegarCelda(this.camino[this.celdaActual]);
        } else {
          this.frac += restante / coste;
          this.distRecorrida += restante;
          restante = 0;
        }
      }
      const a = celdaACentro(...this.camino[this.celdaActual]);
      if (this.celdaActual < this.camino.length - 1) {
        const b = celdaACentro(...this.camino[this.celdaActual + 1]);
        this._pos = { x: a.x + (b.x - a.x) * this.frac, y: a.y + (b.y - a.y) * this.frac };
        if (b.x !== a.x) this.dir = b.x > a.x ? 1 : -1;
      } else this._pos = a;
    } else if (!this.terminado) {
      this._pos = celdaACentro(...this.camino[this.camino.length - 1]);
      this._finalizar();
    }

    if (this.tiempoLimite >= 0 && this.tiempoJuego >= this.tiempoLimite && !this.terminado) {
      this._finalizar();
    }

    this.on.tick && this.on.tick({
      tiempoJuego: this.tiempoJuego,
      restante: Math.max(0, this.tiempoLimite - this.tiempoJuego),
      recogidos: this.recogidos, valor: this.valorActual, volumen: this.volumenActual,
    });
  }

  _llegarCelda(celda) {
    const k = celda[0] + ',' + celda[1];
    if (!this.celdaObjeto.has(k)) return;
    const i = this.celdaObjeto.get(k);
    if (this.recogidos.has(i)) return;
    const o = this.objetos[i];
    if (this.volumenActual + o.volumen > this.capacidad) {
      this.on.noCabe && this.on.noCabe(i);     // parpadeo/aviso, se salta
      return;
    }
    this.recogidos.add(i);
    this.volumenActual += o.volumen; this.valorActual += o.valor;
    this.on.recoger && this.on.recoger(i, this.recogidos.size);
  }

  _finalizar() {
    this.terminado = true; this.corriendo = false;
    const enSalida = this.celdaActual >= this.camino.length - 1;
    const escapa = enSalida && (this.tiempoLimite < 0 || this.tiempoJuego <= this.tiempoLimite + 0.05);
    this.on.fin && this.on.fin({ escapa, tiempoJuego: this.tiempoJuego, recogidos: this.recogidos,
      valor: this.valorActual, volumen: this.volumenActual });
  }
}
