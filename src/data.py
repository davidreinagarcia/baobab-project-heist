"""Lectura de los ficheros de datos del ladron."""
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUT = Path(__file__).resolve().parents[1] / "outputs"


def load_instance(path):
    # 1. La primera linea del fichero tiene dos numeros: cuantos objetos hay y la capacidad
    with open(path) as f:
        primera_linea = f.readline().split()
    capacity = int(primera_linea[1])

    # 2. El resto es una tabla con una fila por objeto: valor y volumen.
    #    int64 porque algunos volumenes son de cientos de millones.
    tabla = np.loadtxt(path, skiprows=1, dtype=np.int64)
    values = tabla[:, 0]
    volumes = tabla[:, 1]
    return values, volumes, capacity
