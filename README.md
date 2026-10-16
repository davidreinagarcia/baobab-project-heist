# baobab-project-heist

El ladron audaz: elegir que objetos robar de un museo con una mochila de capacidad limitada
para maximizar el dinero en el mercado negro (problema de la mochila 0/1).

## Uso

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python -m src.data      # inventario de los 22 datasets, escribe outputs/inventory.csv
    .venv/bin/python -m src.run_all   # resuelve los 22 (~2 min), escribe outputs/results.csv y outputs/solutions/

## Estructura

- `data/`: los 22 ficheros `ks_<objetos>_<n>` del enunciado. Primera linea: `objetos capacidad`.
  Cada linea siguiente: `valor volumen` de un objeto.
- `src/data.py`: `load_instance()` lee un fichero, `inventory()` resume los 22.
- `src/knapsack.py`: `resolver()`, el solver de programacion dinamica de OR-Tools.
- `src/run_all.py`: lanza `resolver()` en los 22, comprueba el resultado y guarda tiempos y objetos.
- `outputs/`: resultados.

## Extension: el golpe con tiempo (`extension/`)

Variante con mapa del museo: los objetos estan repartidos en un plano con paredes, salimos de la
entrada (que tambien es la salida) y hay que volver antes de que llegue la policia. **No forma parte
del analisis oficial**: usa `src/data.py` para leer los objetos pero `src/` no sabe que existe.

    .venv/bin/python -m extension.run    # dibuja el plano y la ruta, escribe outputs/extension.json

- `extension/museo.py`: plano con paredes, colocacion al azar de los objetos y distancias andando (BFS).
- `extension/ruta.py`: el solver exacto. `rutas_mas_cortas()` (programacion dinamica sobre grupos de
  objetos) y `elegir_golpe()` (el grupo de mas valor que cabe en la mochila y se hace a tiempo).
- `extension/golpe.py`: `planificar()`, punto de entrada unico (el que usara la web). Devuelve un
  diccionario listo para JSON: plano, objetos, ruta, camino celda a celda y curva valor/tiempo.
- `extension/run.py`: script de demostracion. Arriba estan los parametros (capacidad, tiempo, semilla...).

Ver `GUIA.md`: la programacion dinamica explicada, por que OR-Tools, y las preguntas de discusion.

### Web-juego "El Golpe" (`extension/web/`)

Juego/simulador en el navegador (atraco de museo nocturno, cartoon) servido en
https://baobab-project-heist.queenalexandria.online. Sin build ni backend: Canvas 2D y modulos ES.

- Motor JS portado 1:1 del Python (`extension/web/js/engine.js`), con paso en 8 direcciones (diagonal
  cuesta √2, sin cortar esquinas). Resto de modulos: `render` (museo 2.5D nocturno), `sprites`
  (sprites recortados de `extension/referencias/`), `personajes` (ladron Mortadelo, policia y coche
  animados sobre sus sprites), `editor` (construir muros), `simulacion`, `audio`, `app`.
- Sprites en `extension/web/assets/sprites/` (WebP con alfa). Ver `extension/web/CREDITS.md`.

Tests (paridad JS/Python, desde la raiz del repo):

    .venv/bin/python -m extension.export_fixtures && node extension/web/test/parity.test.mjs

Despliegue (unico comando; publica en la carpeta que sirve el contenedor `heist-frontend`):

    bash extension/deploy.sh

`deploy.sh` sella una version en las URLs de css/js/json y de los sprites (`window.__V`) para romper
la cache de 4 h de Cloudflare en cada despliegue.
