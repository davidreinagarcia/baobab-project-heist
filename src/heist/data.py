"""Lectura de los ficheros de datos del ladrón."""
import os

import numpy as np
import pandas as pd

RAW_DIR = "data/raw"


def load_instance(path):
    """Lee un fichero ks_* y devuelve (values, volumes, capacity)."""
    with open(path) as f:
        n, capacity = map(int, f.readline().split())
    tabla = np.loadtxt(path, skiprows=1, dtype=np.int64)
    return tabla[:, 0], tabla[:, 1], capacity


def inventory():
    """Una fila por fichero: cuántos objetos, qué capacidad y qué tamaño tendría la tabla de DP."""
    filas = []
    for nombre in os.listdir(RAW_DIR):
        values, volumes, capacity = load_instance(os.path.join(RAW_DIR, nombre))
        filas.append({
            "fichero": nombre,
            "objetos": len(values),
            "capacidad": capacity,
            "celdas_tabla": len(values) * capacity,
            "volumen_total": int(volumes.sum()),
        })
    return pd.DataFrame(filas).sort_values(["objetos", "fichero"]).reset_index(drop=True)


if __name__ == "__main__":
    tabla = inventory()
    tabla["MB_tabla_1byte"] = (tabla["celdas_tabla"] / 1e6).round(1)
    print(tabla.to_string(index=False))
    tabla.to_csv("outputs/inventory.csv", index=False)
