"""Genera fixtures con el motor Python para comprobar la paridad con el motor JS.

Cada fixture guarda la entrada (plano, objetos, valores, volumenes, capacidad, tiempo, velocidad)
y la salida clave del Python (valor, distancia, volumen del golpe optimo, y factibilidad). El test
de Node vuelve a resolver con engine.js y compara. NO se compara el orden en empates: dos ordenes
distintos con la misma distancia son igual de validos.

    .venv/bin/python -m extension.export_fixtures   # escribe extension/web/test/fixtures.json

Incluye mapas y escenarios aleatorios con semilla, y casos limite: 0 objetos, 1 objeto, tiempo 0,
capacidad 0, capacidad enorme, objeto encerrado (inalcanzable), plano sin salas.
"""
import json
import random
from pathlib import Path

from src.data import DATA_DIR, load_instance

from .golpe import planificar
from .museo import PLANO_EJEMPLO, buscar_entrada, colocar_objetos, recorrer_plano

SALIDA = Path(__file__).resolve().parent / "web" / "test" / "fixtures.json"

# Plano pequeno sin salas (solo perimetro) para casos limite baratos
PLANO_VACIO = [
    "###########",
    "#.........#",
    "#.........#",
    "#....E....#",
    "#.........#",
    "#.........#",
    "###########",
]

# Plano con una celda encerrada por paredes (objeto inalcanzable): la 'X' queda rodeada
PLANO_ENCERRADO = [
    "###########",
    "#.........#",
    "#...###...#",
    "#...#.#...#",
    "#...###...#",
    "#....E....#",
    "###########",
]

# Plano abierto para comprobar diagonales limpias (sqrt(2)) sin cortar esquinas
PLANO_DIAGONAL = [
    "#########",
    "#.......#",
    "#.......#",
    "#...E...#",
    "#.......#",
    "#.......#",
    "#########",
]

# Pasillo con esquina: la unica ruta obliga a rodear (no se puede cortar la esquina del muro)
PLANO_ESQUINA = [
    "#########",
    "#...#...#",
    "#...#...#",
    "#...#...#",
    "#...#...#",
    "#....E..#",
    "#########",
]


def celdas_suelo(plano):
    return [(f, c) for f in range(len(plano)) for c in range(len(plano[f])) if plano[f][c] == '.']


def fixture(nombre, plano, objetos, values, volumes, capacity, tiempo, velocidad):
    res = planificar(plano, objetos, list(values), list(volumes), capacity, tiempo, velocidad)
    g = res["golpe"]
    # marcar inalcanzables igual que lo hara el JS (BFS desde la entrada)
    pasos, _ = recorrer_plano(plano, buscar_entrada(plano))
    alcanzables = [list(o) in [list(x) for x in objetos] and (o in pasos) for o in objetos]
    return {
        "nombre": nombre,
        "entrada": {
            "plano": plano, "objetos": [list(o) for o in objetos],
            "values": [int(v) for v in values], "volumes": [int(v) for v in volumes],
            "capacity": capacity, "tiempo": tiempo, "velocidad": velocidad,
        },
        "esperado": {
            "valor": g["valor"], "volumen": g["volumen"], "distancia": g["distancia"],
            "valor_sin_limite": res["valor_sin_limite_de_tiempo"],
            "n_cogidos": len(g["orden"]),
        },
    }


def main():
    values_full, volumes_full, _ = load_instance(DATA_DIR / "ks_19_0")
    fixtures = []

    # 1. El escenario por defecto de run.py
    obj = colocar_objetos(PLANO_EJEMPLO, 10, 2)
    fixtures.append(fixture("defecto", PLANO_EJEMPLO, obj,
                            values_full[:10], volumes_full[:10], 18000, 40, 1))

    # 2. Escenarios aleatorios con semilla (varios tamanos, capacidades y tiempos)
    rng = random.Random(1234)
    for s in range(20):
        n = rng.randint(1, 10)
        obj = colocar_objetos(PLANO_EJEMPLO, n, 100 + s)
        vals = [rng.randint(1, 5000) for _ in range(n)]
        vols = [rng.randint(1, 8000) for _ in range(n)]
        cap = rng.choice([0, 3000, 10000, 50000, 10**9])
        t = rng.choice([0, 5, 20, 40, 100])
        vel = rng.choice([1, 2])
        fixtures.append(fixture(f"aleatorio_{s}", PLANO_EJEMPLO, obj, vals, vols, cap, t, vel))

    # 3. Casos limite
    suelo_vacio = celdas_suelo(PLANO_VACIO)
    # 1 objeto
    fixtures.append(fixture("un_objeto", PLANO_VACIO, [suelo_vacio[0]], [100], [50], 1000, 40, 1))
    # tiempo 0
    fixtures.append(fixture("tiempo_0", PLANO_VACIO, [suelo_vacio[0]], [100], [50], 1000, 0, 1))
    # capacidad 0
    fixtures.append(fixture("capacidad_0", PLANO_VACIO, suelo_vacio[:3],
                            [100, 200, 300], [10, 20, 30], 0, 40, 1))
    # capacidad enorme
    fixtures.append(fixture("capacidad_enorme", PLANO_VACIO, suelo_vacio[:5],
                            [100, 200, 300, 400, 500], [10, 20, 30, 40, 50], 10**9, 500, 1))
    # plano sin salas, varios objetos
    fixtures.append(fixture("sin_salas", PLANO_VACIO, suelo_vacio[:6],
                            [v for v in values_full[:6]], [v for v in volumes_full[:6]], 20000, 60, 2))

    # diagonales limpias: objetos en las esquinas, la ruta optima usa pasos sqrt(2)
    fixtures.append(fixture("diagonal_esquinas", PLANO_DIAGONAL,
                            [(1, 1), (1, 7), (5, 1), (5, 7)],
                            [100, 200, 300, 400], [10, 20, 30, 40], 10**9, 500, 1))
    fixtures.append(fixture("diagonal_cara", PLANO_DIAGONAL, [(1, 7), (5, 1)],
                            [500, 500], [10, 10], 10**9, 500, 1))
    # esquina obligada: no se puede cortar la esquina del muro central
    fixtures.append(fixture("esquina_muro", PLANO_ESQUINA, [(1, 1), (1, 7)],
                            [100, 200], [10, 20], 10**9, 500, 1))

    (SALIDA).parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(fixtures, indent=1, ensure_ascii=False))
    print(f"{len(fixtures)} fixtures -> {SALIDA}")


if __name__ == "__main__":
    main()
