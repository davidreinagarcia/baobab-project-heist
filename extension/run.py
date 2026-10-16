"""Ejecuta el golpe con tiempo: coloca los objetos en el museo, elige la ruta y la dibuja.

Todos los datos que se pueden cambiar estan arriba (plano, objetos, capacidad, tiempo...).
Guarda el resultado en outputs/extension.json.
"""
import json

from src.data import DATA_DIR, OUT, load_instance

from .golpe import planificar
from .museo import PLANO_EJEMPLO, colocar_objetos

PLANO = PLANO_EJEMPLO
DATASET = "ks_19_0"
N_OBJETOS = 10      # solo usamos los primeros objetos del dataset (aqui, la mitad de ks_19_0)
SEMILLA = 2         # cambia donde caen los objetos en el museo
CAPACIDAD = 18000   # lo que aguanta la mochila (mismas unidades que el volumen de los objetos)
TIEMPO = 40         # segundos hasta que llega la policia
VELOCIDAD = 1       # celdas del plano que andamos por segundo


def dibujar(resultado):
    # Plano en texto: '*' es el camino, letra mayuscula = objeto robado, minuscula = lo dejamos
    lineas = [list(fila) for fila in resultado["plano"]]
    for fila, col in resultado["golpe"]["camino"]:
        if lineas[fila][col] == ".":
            lineas[fila][col] = "*"
    for objeto in resultado["objetos"]:
        letra = objeto["id"] if objeto["cogido"] else objeto["id"].lower()
        lineas[objeto["fila"]][objeto["col"]] = letra
    return ["".join(fila) for fila in lineas]


def mostrar(resultado):
    golpe = resultado["golpe"]
    parametros = resultado["parametros"]
    print("\n".join(dibujar(resultado)))

    print("\nObjetos (A, B, C... en el plano):")
    for objeto in resultado["objetos"]:
        cogido = "SI" if objeto["cogido"] else "no"
        print(f"  {objeto['id']}  valor {objeto['valor']:>5d}  volumen {objeto['volumen']:>6d}  {cogido}")

    print(f"\nRuta: entrada -> {' -> '.join(golpe['orden'])} -> entrada")
    print(f"Valor {golpe['valor']}, mochila {golpe['volumen']}/{parametros['capacidad']}, "
          f"tiempo {golpe['tiempo']:.0f}/{parametros['tiempo']} s")
    perdido = resultado["valor_sin_limite_de_tiempo"] - golpe["valor"]
    print(f"Sin limite de tiempo se conseguiria {resultado['valor_sin_limite_de_tiempo']} "
          f"(la policia nos cuesta {perdido})")

    print("\nValor segun el tiempo disponible:")
    for fila in resultado["valor_segun_tiempo"]:
        print(f"  {fila['tiempo']:>4d} s  valor {fila['valor']:>6d}  ({fila['objetos']} objetos)")


def main():
    # 1. Objetos: los primeros N del dataset, cada uno colocado en un sitio al azar del museo
    values, volumes, _ = load_instance(DATA_DIR / DATASET)
    values, volumes = values[:N_OBJETOS], volumes[:N_OBJETOS]
    objetos = colocar_objetos(PLANO, N_OBJETOS, SEMILLA)

    # 2. Elegir el mejor golpe con la capacidad y el tiempo actuales
    resultado = planificar(PLANO, objetos, values, volumes, CAPACIDAD, TIEMPO, VELOCIDAD)

    # 3. Mostrarlo y guardarlo para la web
    mostrar(resultado)
    resultado["parametros"].update({"dataset": DATASET, "semilla": SEMILLA})
    OUT.mkdir(exist_ok=True)
    (OUT / "extension.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
