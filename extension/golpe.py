"""Motor del golpe con tiempo: unico punto de entrada para el script y para la web.

planificar() recibe el museo, los objetos y las condiciones (capacidad, tiempo, velocidad) y
devuelve un diccionario con todo lo que hace falta para dibujarlo: el plano, los objetos, la
ruta elegida, el camino celda a celda y el valor que se consigue con mas o menos tiempo.
Solo contiene numeros, textos y listas, asi que se puede guardar como JSON tal cual.
"""
from .museo import buscar_entrada, camino, matriz_distancias
from .ruta import elegir_golpe, rutas_mas_cortas

LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def camino_completo(plano, objetos, orden):
    # Todas las celdas por las que pasa el ladron: entrada -> objetos en orden -> entrada
    entrada = buscar_entrada(plano)
    paradas = [entrada] + [objetos[i] for i in orden] + [entrada]
    celdas = [entrada]
    for origen, destino in zip(paradas, paradas[1:]):
        celdas = celdas + camino(plano, origen, destino)[1:]
    return celdas


def planificar(plano, objetos, values, volumes, capacity, tiempo, velocidad):
    # 1. Rutas mas cortas para cada grupo de objetos (la parte pesada)
    tabla = rutas_mas_cortas(matriz_distancias(plano, objetos))

    # 2. El mejor golpe: la distancia maxima es lo que andamos hasta que llega la policia
    golpe = elegir_golpe(tabla, values, volumes, capacity, velocidad * tiempo)
    orden = golpe["orden"]

    # 3. Para comparar: el valor que habria sin limite de tiempo (la mochila de siempre)
    sin_limite = elegir_golpe(tabla, values, volumes, capacity, float("inf"))

    # 4. Valor segun el tiempo disponible, de 10 en 10 segundos (la tabla no se vuelve a calcular)
    curva = []
    for t in range(0, int(sin_limite["distancia"] / velocidad) + 11, 10):
        g = elegir_golpe(tabla, values, volumes, capacity, velocidad * t)
        curva.append({"tiempo": t, "valor": g["valor"], "objetos": len(g["orden"])})

    # 5. Armar el resultado
    lista_objetos = []
    for i in range(len(objetos)):
        lista_objetos.append({"id": LETRAS[i], "fila": objetos[i][0], "col": objetos[i][1],
                              "valor": int(values[i]), "volumen": int(volumes[i]),
                              "cogido": i in orden})
    celdas = camino_completo(plano, objetos, orden)
    return {
        "parametros": {"capacidad": capacity, "tiempo": tiempo, "velocidad": velocidad},
        "plano": plano,
        "entrada": list(buscar_entrada(plano)),
        "objetos": lista_objetos,
        "golpe": {"orden": [LETRAS[i] for i in orden], "valor": golpe["valor"],
                  "volumen": golpe["volumen"], "distancia": golpe["distancia"],
                  "tiempo": golpe["distancia"] / velocidad,
                  "camino": [list(celda) for celda in celdas]},
        "valor_sin_limite_de_tiempo": sin_limite["valor"],
        "valor_segun_tiempo": curva,
    }
