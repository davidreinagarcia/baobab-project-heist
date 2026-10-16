"""El museo: plano con paredes, objetos colocados al azar y distancias andando entre ellos."""
import heapq
import math
import random

# Plano del museo. '#' pared, '.' suelo, 'E' entrada (que tambien es la salida).
PLANO_EJEMPLO = [
    "########################################",
    "#..........#...........#...............#",
    "#..........#...........#......##.......#",
    "#..........#...........#......##.......#",
    "#......................................#",
    "#..........#...........#...............#",
    "#..........#...........#...............#",
    "#####.###########.#############.########",
    "#......................................#",
    "#...........##............##...........#",
    "#......................................#",
    "######.############.#############.######",
    "#............#............#............#",
    "#......................................#",
    "#............#............#............#",
    "#............#......E.....#............#",
    "########################################",
]

# Movimiento en 8 direcciones. La velocidad es constante, asi que un paso diagonal recorre
# sqrt(2) celdas de distancia (no 1 ni 2): no se suman las componentes como vectores.
RAIZ2 = math.sqrt(2)
MOVIMIENTOS = [
    ((-1, 0), 1.0), ((1, 0), 1.0), ((0, -1), 1.0), ((0, 1), 1.0),
    ((-1, -1), RAIZ2), ((-1, 1), RAIZ2), ((1, -1), RAIZ2), ((1, 1), RAIZ2),
]


def buscar_entrada(plano):
    for fila in range(len(plano)):
        if "E" in plano[fila]:
            return (fila, plano[fila].index("E"))


def _transitable(plano, fila, col):
    return 0 <= fila < len(plano) and 0 <= col < len(plano[fila]) and plano[fila][col] != "#"


def recorrer_plano(plano, origen):
    # Camina el plano desde `origen` con 8 vecinos y coste 1 / sqrt(2) (Dijkstra).
    # No se permite cortar esquinas: un paso diagonal esta prohibido si alguna de las dos
    # celdas ortogonales adyacentes es muro. Devuelve distancia a cada celda alcanzable y de
    # que celda se llego (para reconstruir el camino al revés).
    dist = {origen: 0.0}
    venimos_de = {origen: None}
    cola = [(0.0, origen)]
    while cola:
        d, (fila, col) = heapq.heappop(cola)
        if d > dist[(fila, col)]:
            continue
        for (d_fila, d_col), coste in MOVIMIENTOS:
            nf, nc = fila + d_fila, col + d_col
            if not _transitable(plano, nf, nc):
                continue
            if d_fila != 0 and d_col != 0:  # diagonal: no cortar esquinas
                if not (_transitable(plano, fila + d_fila, col) and _transitable(plano, fila, col + d_col)):
                    continue
            nd = d + coste
            if nd < dist.get((nf, nc), math.inf) - 1e-12:
                dist[(nf, nc)] = nd
                venimos_de[(nf, nc)] = (fila, col)
                heapq.heappush(cola, (nd, (nf, nc)))
    return dist, venimos_de


def tapada_por_muro(plano, celda):
    # En la vista oblicua el muro de la fila de abajo tapa la parte baja de esta celda, asi
    # que un objeto puesto al azar ahi se veria cortado. Solo se puede dejar a mano.
    fila, col = celda
    return fila + 1 < len(plano) and col < len(plano[fila + 1]) and plano[fila + 1][col] == "#"


def colocar_objetos(plano, cuantos, semilla):
    # Elige `cuantos` celdas distintas al azar entre las que se pueden alcanzar desde la
    # entrada (sin contar la propia entrada) y que no queden tapadas por un muro.
    # Con la misma semilla salen siempre las mismas.
    entrada = buscar_entrada(plano)
    dist, _ = recorrer_plano(plano, entrada)
    candidatas = sorted(celda for celda in dist
                        if celda != entrada and not tapada_por_muro(plano, celda))
    return random.Random(semilla).sample(candidatas, cuantos)


def matriz_distancias(plano, objetos):
    # Tabla de distancias andando entre todos los puntos. El punto 0 es la entrada y los
    # puntos 1, 2, 3... son los objetos en el orden en que vienen en `objetos`.
    puntos = [buscar_entrada(plano)] + list(objetos)
    tabla = []
    for origen in puntos:
        dist, _ = recorrer_plano(plano, origen)
        tabla.append([dist.get(destino, math.inf) for destino in puntos])
    return tabla


def camino(plano, origen, destino):
    # Lista de celdas por las que se pasa yendo de `origen` a `destino` por el camino mas corto
    _, venimos_de = recorrer_plano(plano, origen)
    if destino not in venimos_de:
        return []
    celdas = []
    celda = destino
    while celda is not None:
        celdas.append(celda)
        celda = venimos_de[celda]
    celdas.reverse()
    return celdas
