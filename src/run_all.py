"""Lanza el solver en los 22 datasets y guarda valor, tiempo y objetos elegidos en outputs/."""
import time

import pandas as pd

from .data import DATA_DIR, OUT, load_instance
from .knapsack import resolver


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "solutions").mkdir(exist_ok=True)

    filas = []
    for fichero in sorted(DATA_DIR.iterdir()):
        nombre = fichero.name

        # 1. Leer el dataset y resolverlo, midiendo cuanto tarda
        values, volumes, capacity = load_instance(fichero)
        inicio = time.time()
        valor, elegidos, optimo = resolver(values, volumes, capacity)
        segundos = time.time() - inicio

        # 2. Comprobar el resultado sin fiarnos del solver: sumamos nosotros lo que lleva la
        #    mochila. No puede pasarse de la capacidad y el dinero tiene que coincidir.
        volumen_usado = int(volumes[elegidos].sum())
        assert volumen_usado <= capacity, f"{nombre}: la mochila se pasa de capacidad"
        assert int(values[elegidos].sum()) == valor, f"{nombre}: el valor no cuadra"

        # 3. Guardar la solucion en un fichero por dataset. Primera linea: el valor y un 1 si
        #    es el maximo demostrado (0 si no). Segunda linea: un 1 por cada objeto cogido
        #    y un 0 por cada objeto que se deja.
        marcas = []
        for i in range(len(values)):
            if i in elegidos:
                marcas.append("1")
            else:
                marcas.append("0")
        primera_linea = f"{valor} {int(optimo)}"
        segunda_linea = " ".join(marcas)
        (OUT / "solutions" / nombre).write_text(primera_linea + "\n" + segunda_linea + "\n")

        # 4. Apuntar una fila para la tabla resumen
        filas.append({"fichero": nombre, "objetos": len(values), "capacidad": capacity,
                      "valor": valor, "volumen_usado": volumen_usado,
                      "objetos_cogidos": len(elegidos), "optimo": optimo,
                      "segundos": round(segundos, 2)})
        print(f"{nombre:18s} valor {valor:>10d}  optimo {optimo}  {segundos:6.2f} s")

    resumen = pd.DataFrame(filas).sort_values(["objetos", "fichero"])
    resumen.to_csv(OUT / "results.csv", index=False)


if __name__ == "__main__":
    main()
