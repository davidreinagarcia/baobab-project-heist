# baobab-project-heist

El ladron audaz: elegir que objetos robar de un museo con una mochila de capacidad limitada
para maximizar el dinero en el mercado negro (problema de la mochila 0/1).

## Uso

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python -m src.heist.data      # inventario de los 22 datasets, escribe outputs/inventory.csv
    .venv/bin/python -m src.heist.run_all   # resuelve los 22 (~2 min), escribe outputs/results.csv y outputs/solutions/

## Estructura

- `data/raw/`: los 22 ficheros `ks_<objetos>_<n>` del enunciado. Primera linea: `objetos capacidad`.
  Cada linea siguiente: `valor volumen` de un objeto.
- `src/heist/data.py`: `load_instance()` lee un fichero, `inventory()` resume los 22.
- `src/heist/knapsack.py`: `resolver()`, el solver de programacion dinamica de OR-Tools.
- `src/heist/run_all.py`: lanza `resolver()` en los 22, comprueba el resultado y guarda tiempos y objetos.
- `outputs/`: resultados.

Ver `GUIA.md`: la programacion dinamica explicada, por que OR-Tools, y las preguntas de discusion.
