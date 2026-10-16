// parity.test.mjs — compara el motor JS contra las fixtures del motor Python.
// Ejecutar desde la raiz del repo:  node extension/web/test/parity.test.mjs
// (requiere haber corrido antes:  .venv/bin/python -m extension.export_fixtures)
//
// Compara valor, volumen, distancia y valor_sin_limite del golpe optimo. NO compara el orden:
// en empates de valor hay varios ordenes igual de validos. Ademas comprueba a mano que un objeto
// encerrado se marca inalcanzable y se excluye (sin romper), cosa que el Python no soporta.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planificar } from '../js/engine.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(aqui, 'fixtures.json'), 'utf8'));

let pasados = 0, fallos = 0;
function comprobar(nombre, cond, detalle) {
  if (cond) { pasados++; } else { fallos++; console.error(`  FALLO [${nombre}] ${detalle}`); }
}

for (const fx of fixtures) {
  const e = fx.entrada;
  const res = planificar(e.plano, e.objetos, e.values, e.volumes, e.capacity, e.tiempo, e.velocidad);
  const g = res.golpe;
  const d = fx.esperado;
  const dist = Number.isFinite(g.distancia) ? g.distancia : -1;
  const distEsp = Number.isFinite(d.distancia) ? d.distancia : -1;
  comprobar(fx.nombre, g.valor === d.valor, `valor JS=${g.valor} PY=${d.valor}`);
  comprobar(fx.nombre, g.volumen === d.volumen, `volumen JS=${g.volumen} PY=${d.volumen}`);
  // distancia ahora es float (diagonales sqrt(2)): tolerancia 1e-9
  comprobar(fx.nombre, Math.abs(dist - distEsp) < 1e-9, `distancia JS=${dist} PY=${distEsp}`);
  comprobar(fx.nombre, res.valor_sin_limite_de_tiempo === d.valor_sin_limite,
    `sin_limite JS=${res.valor_sin_limite_de_tiempo} PY=${d.valor_sin_limite}`);
}

// Caso extra JS-only: objeto encerrado. El Python lanzaria KeyError; el JS debe seguir vivo,
// marcar el objeto como inalcanzable y resolver con el resto.
{
  const plano = [
    '###########',
    '#.........#',
    '#...###...#',
    '#...#.#...#',  // la celda (3,5) esta rodeada de paredes
    '#...###...#',
    '#....E....#',
    '###########',
  ];
  const objetos = [[3, 5], [1, 1], [5, 9]]; // el primero esta encerrado
  const res = planificar(plano, objetos, [1000, 10, 20], [1, 1, 1], 1000, 100, 1);
  comprobar('encerrado', res.objetos[0].alcanzable === false, 'el objeto encerrado deberia ser inalcanzable');
  comprobar('encerrado', res.objetos[1].alcanzable === true, 'objeto normal deberia ser alcanzable');
  comprobar('encerrado', !res.golpe.ordenIdx.includes(0), 'el golpe no debe incluir el objeto encerrado');
  comprobar('encerrado', Number.isFinite(res.golpe.distancia), 'la distancia del golpe debe ser finita');
}

// 0 objetos: debe resolver con valor 0 sin romper
{
  const plano = ['#####', '#.E.#', '#####'];
  const res = planificar(plano, [], [], [], 100, 40, 1);
  comprobar('cero_objetos', res.golpe.valor === 0 && res.golpe.ordenIdx.length === 0, 'sin objetos debe dar valor 0');
}

console.log(`\nParidad JS/Python: ${pasados} comprobaciones OK, ${fallos} fallos.`);
process.exit(fallos === 0 ? 0 : 1);
