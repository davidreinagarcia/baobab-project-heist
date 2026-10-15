# baobab-project-heist

El ladron audaz: elegir que objetos robar de un museo con una mochila de capacidad limitada
para maximizar el dinero en el mercado negro (problema de la mochila 0/1).

## Uso

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python -m src.heist.data    # inventario de los 22 datasets, escribe outputs/inventory.csv

## Estructura

- `data/raw/`: los 22 ficheros `ks_<objetos>_<n>` del enunciado. Primera linea: `objetos capacidad`.
  Cada linea siguiente: `valor volumen` de un objeto.
- `src/heist/data.py`: `load_instance()` lee un fichero, `inventory()` resume los 22.
- `outputs/`: resultados.

Ver `GUIA.md`: explicacion de la programacion dinamica, por que es la eleccion, y como se explica el codigo.
