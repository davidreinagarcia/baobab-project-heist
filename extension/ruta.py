"""Elegir que objetos robar y en que orden, sin pasarse de mochila ni de tiempo.

Se hace en dos pasos:
  1. rutas_mas_cortas(): para CADA grupo posible de objetos, el recorrido mas corto que sale de
     la entrada, los recoge todos y vuelve. Solo depende del plano y de donde estan los objetos.
  2. elegir_golpe(): de todos esos grupos, el de mas valor que cabe en la mochila y se hace a
     tiempo. Es un filtro rapido, asi que se puede repetir al mover la capacidad o el tiempo.
"""
from itertools import combinations


def rutas_mas_cortas(dist):
    # `dist` es la tabla de distancias: punto 0 = entrada, puntos 1..n = objetos.
    # Programacion dinamica, igual que la mochila: la ruta mas corta que termina en el objeto
    # `ultimo` pasando por un grupo se construye con la ruta mas corta del grupo sin `ultimo`.
    n = len(dist) - 1
    objetos = range(1, n + 1)

    # mejor[(grupo, ultimo)] = (distancia desde la entrada, objeto anterior). Para grupos de 1.
    mejor = {}
    for j in objetos:
        mejor[(frozenset([j]), j)] = (dist[0][j], 0)

    # Grupos cada vez mas grandes: 2 objetos, 3, 4...
    for tamano in range(2, n + 1):
        for combinacion in combinations(objetos, tamano):
            grupo = frozenset(combinacion)
            for ultimo in grupo:
                resto = grupo - {ultimo}
                opciones = []
                for anterior in resto:
                    d = mejor[(resto, anterior)][0] + dist[anterior][ultimo]
                    opciones.append((d, anterior))
                mejor[(grupo, ultimo)] = min(opciones)

    # Cerrar el circuito: tras el ultimo objeto hay que volver a la entrada
    tabla = {frozenset(): (0, [])}
    for tamano in range(1, n + 1):
        for combinacion in combinations(objetos, tamano):
            grupo = frozenset(combinacion)
            opciones = []
            for ultimo in grupo:
                opciones.append((mejor[(grupo, ultimo)][0] + dist[ultimo][0], ultimo))
            distancia_total, ultimo = min(opciones)

            # Reconstruir el orden yendo hacia atras desde el ultimo objeto
            orden = []
            grupo_actual = grupo
            while ultimo != 0:
                orden.append(ultimo - 1)  # objeto 0, 1, 2... (el punto 1 es el objeto 0)
                anterior = mejor[(grupo_actual, ultimo)][1]
                grupo_actual = grupo_actual - {ultimo}
                ultimo = anterior
            orden.reverse()
            tabla[grupo] = (distancia_total, orden)
    return tabla


def elegir_golpe(tabla, values, volumes, capacity, distancia_max):
    # Recorre todos los grupos y se queda con el de mas valor que cumpla las dos condiciones.
    # Si hay empate de valor, gana el recorrido mas corto.
    mejor = {"valor": 0, "volumen": 0, "distancia": 0, "orden": []}
    for distancia, orden in tabla.values():
        valor = int(sum(values[i] for i in orden))
        volumen = int(sum(volumes[i] for i in orden))
        # tolerancia 1e-9 al filtrar por distancia (ahora es float por las diagonales sqrt(2))
        if volumen > capacity or distancia > distancia_max + 1e-9:
            continue
        if valor > mejor["valor"] or (valor == mejor["valor"] and distancia < mejor["distancia"]):
            mejor = {"valor": valor, "volumen": volumen, "distancia": distancia, "orden": orden}
    return mejor
