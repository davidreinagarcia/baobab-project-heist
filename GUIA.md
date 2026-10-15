# Guía del proyecto (para explicarlo línea por línea)

## La historia en 30 segundos

Un ladrón entra a un museo con una mochila pequeña. Cada objeto tiene un valor (lo que paga el mercado
negro) y un volumen (lo que ocupa en la mochila). No puede llevárselo todo: hay que decidir qué objetos
coger para que el dinero total sea el máximo sin pasarse de la capacidad. Es el **problema de la mochila
0/1** (0/1 porque cada objeto se coge entero o se deja, no se pueden coger medios).

Lo resolvemos con **programación dinámica (DP)**: vamos construyendo una tabla de soluciones pequeñas
hasta llegar a la solución del problema completo. Lo probamos con los 22 datasets del enunciado, de
3 a 10.000 objetos.

## Mapa del código

| Fichero | Qué hace | Funciones | Estado |
|---|---|---|---|
| `src/heist/data.py` | Lee los ficheros `ks_*` y resume los 22 datasets | `load_instance()`, `inventory()` | hecho |
| `src/heist/knapsack.py` | La programación dinámica y la recuperación de los objetos elegidos | por decidir | pendiente |
| `src/heist/run_all.py` | Lanza la DP en los 22 datasets y guarda valor, tiempo y objetos | por decidir | pendiente |

Se lanza con `.venv/bin/python -m src.heist.data`. Escribe `outputs/inventory.csv`.

## Formato de los datos

Cada fichero de `data/raw/` se llama `ks_<objetos>_<número>`. La primera línea tiene dos números, la
cantidad de objetos `n` y la capacidad de la mochila `K`. Cada una de las `n` líneas siguientes tiene
`valor volumen` de un objeto. Ejemplo, `ks_lecture_dp_1`:

    3 9        ← 3 objetos, capacidad 9
    5 4        ← objeto 1: vale 5, ocupa 4
    6 5        ← objeto 2: vale 6, ocupa 5
    3 2        ← objeto 3: vale 3, ocupa 2

Los ficheros `ks_lecture_dp_*` son de la clase (3 y 4 objetos, se resuelven a mano), y `ks_4_0` es el
más pequeño de los de prueba. Los demás van creciendo hasta `ks_10000_0`.

---

# Glosario (léelo antes que nada)

**Problema de la mochila 0/1.** Elegir un subconjunto de objetos que maximice la suma de valores con la
restricción de que la suma de volúmenes no supere la capacidad `K`. En lenguaje de ISyE es un problema de
programación entera con una sola restricción y variables binarias:

    maximizar   suma de (valor_i · x_i)
    sujeto a    suma de (volumen_i · x_i) <= K
                x_i en {0, 1}     (x_i = 1 si cogemos el objeto i)

**Solución óptima.** La mejor posible, no solo una buena. Si dos métodos son exactos, tienen que dar
el mismo valor óptimo (ya lo usaremos para validar).

**Fuerza bruta.** Probar todas las combinaciones. Con `n` objetos hay 2^n. Con 50 objetos son 10^15
combinaciones: a mil millones por segundo, unas dos semanas. Con 1.000 objetos son 10^301, más que
átomos en el universo. Descartada.

**Algoritmo voraz (greedy).** Coger primero lo que más renta por unidad de volumen (valor/volumen) hasta
que no quepa más. Es rápido, pero **no es óptimo**. Ejemplo con `ks_lecture_dp_1`:

| Objeto | Valor | Volumen | Valor/volumen |
|---|---|---|---|
| 1 | 5 | 4 | 1,25 |
| 2 | 6 | 5 | 1,20 |
| 3 | 3 | 2 | 1,50 |

El voraz coge el 3 (volumen 2) y el 1 (volumen 4): llevamos 6 de 9 de volumen y 8 de valor. El objeto 2
ya no cabe (6 + 5 = 11 > 9). Resultado: 8. Pero cogiendo el 1 y el 2 (volumen 4 + 5 = 9, justo lleno)
sale **11**. El voraz se equivoca porque deja volumen sin usar.

**Subproblema.** Una versión más pequeña del mismo problema. Aquí: "¿cuál es el máximo valor si solo
puedo mirar los primeros `i` objetos y la mochila tiene capacidad `c`?"

**Programación dinámica.** Técnica que resuelve un problema grande resolviendo antes todos sus
subproblemas pequeños, apuntando cada respuesta en una tabla y reutilizándola, en vez de recalcularla
cada vez. Funciona cuando la solución óptima del problema grande está hecha con soluciones óptimas de
subproblemas más pequeños.

**Tabla de DP.** Una matriz `dp` con una fila por cada número de objetos considerados (0 a n) y una
columna por cada capacidad (0 a K). La celda `dp[i][c]` guarda la respuesta al subproblema
"primeros `i` objetos, capacidad `c`". La respuesta final es la esquina `dp[n][K]`.

**Recurrencia.** La regla que rellena cada celda a partir de celdas ya calculadas (la fórmula de más
abajo).

**Pseudopolinómico.** El coste de la DP es `n · K`. Parece polinómico, pero `K` es un valor numérico,
no una cantidad de objetos: si la capacidad pasa de 10^5 a 10^8, la tabla se hace 1.000 veces más
grande aunque haya los mismos objetos. Es el punto débil de la DP y por eso hay una sección dedicada
más abajo.

**Programación lineal entera (`milp`).** Resolver el modelo de arriba (maximizar, restricción, `x_i`
binarias) con un solver genérico que usa ramificación y acotación (branch and bound). No es
programación dinámica, es otra familia de método.

---

# Programación dinámica: cómo funciona

## La idea

Para decidir el objeto `i` con capacidad `c`, solo hay dos opciones, y las dos se comparan con
respuestas que ya tenemos:

- **No cogerlo.** Entonces el valor es el mejor que se podía hacer con los `i-1` primeros objetos y la
  misma capacidad: `dp[i-1][c]`.
- **Cogerlo** (solo si `volumen_i <= c`). Cobramos `valor_i`, y nos queda capacidad `c - volumen_i`
  para los `i-1` primeros objetos: `valor_i + dp[i-1][c - volumen_i]`.

Nos quedamos con la mejor de las dos.

## La recurrencia

    dp[0][c] = 0                                     (sin objetos no hay valor)

    si volumen_i > c:   dp[i][c] = dp[i-1][c]        (no cabe, solo queda no cogerlo)
    si volumen_i <= c:  dp[i][c] = max( dp[i-1][c],  valor_i + dp[i-1][c - volumen_i] )

La respuesta del problema es `dp[n][K]`.

## Por qué da el óptimo (la justificación que te pueden pedir)

Es el **principio de optimalidad**. Supón que la mejor mochila posible con los `i` primeros objetos y
capacidad `c` contiene el objeto `i`. Lo que hay en la mochila aparte del objeto `i` tiene que ser la
mejor mochila posible con los `i-1` primeros objetos y capacidad `c - volumen_i`. Si no lo fuera,
podríamos cambiarla por una mejor y la mochila total mejoraría, lo que contradice que fuera la mejor. Lo
mismo si no contiene el objeto `i`: entonces es la mejor con `i-1` objetos. Como la recurrencia mira las
dos posibilidades y se queda con la mayor, no se puede escapar el óptimo.

## Ejemplo a mano: `ks_lecture_dp_1` (3 objetos, capacidad 9)

Objetos: 1 = (valor 5, volumen 4), 2 = (6, 5), 3 = (3, 2). Cada fila es "mirando hasta el objeto i"
y cada columna una capacidad de 0 a 9:

| | c=0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| i=0 (sin objetos) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| i=1 (objeto 1) | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 5 | 5 | 5 |
| i=2 (objeto 2) | 0 | 0 | 0 | 0 | 5 | 6 | 6 | 6 | 6 | **11** |
| i=3 (objeto 3) | 0 | 0 | 3 | 3 | 5 | 6 | 8 | 9 | 9 | **11** |

Cómo se rellena una celda, por ejemplo `dp[2][9]` (objeto 2, capacidad 9): no cogerlo da `dp[1][9] = 5`.
Cogerlo da `6 + dp[1][9-5] = 6 + dp[1][4] = 6 + 5 = 11`. Gana 11.

Y `dp[3][6]` (objeto 3, capacidad 6): no cogerlo da `dp[2][6] = 6`; cogerlo da
`3 + dp[2][6-2] = 3 + dp[2][4] = 3 + 5 = 8`. Gana 8.

La respuesta es `dp[3][9] = 11`, el mismo 11 que encontramos antes y que el voraz no vio.

## Qué objetos hay que coger (no solo cuánto dinero)

La tabla da el valor, no la lista de objetos. Para recuperarla se recorre al revés desde la esquina
`dp[n][K]`:

1. Estamos en la fila `i`, columna `c`. Si `dp[i][c]` es igual a `dp[i-1][c]`, el objeto `i` no hizo falta:
   subimos a la fila `i-1` sin tocar `c`.
2. Si es distinto, el objeto `i` se cogió: lo apuntamos y pasamos a la fila `i-1`, columna
   `c - volumen_i`.
3. Repetimos hasta la fila 0.

En el ejemplo: `dp[3][9] = 11 = dp[2][9]`, el objeto 3 no se coge. `dp[2][9] = 11 ≠ dp[1][9] = 5`, se
coge el objeto 2 y pasamos a `dp[1][4]`. `dp[1][4] = 5 ≠ dp[0][4] = 0`, se coge el objeto 1.
Conclusión: objetos 1 y 2, valor 11, volumen 9.

Esto exige guardar la tabla entera (o al menos qué se decidió en cada celda). Si solo quisiéramos el
valor total bastaría con una fila, pero para el ladrón la lista de objetos es lo importante.

---

# Por qué DP es la mejor elección para esta tarea

1. **Es exacta.** El enunciado pide decidir qué objetos robar para ganar el máximo. El voraz se equivoca
   (8 frente a 11 en el ejemplo de clase), y las heurísticas no garantizan nada. La DP garantiza el óptimo.
2. **Es rápida donde importa.** Pasa de 2^n a `n · K` operaciones. Con 1.000 objetos y capacidad 100.000
   son 10^8 operaciones en vez de 10^301.
3. **Es fácil de explicar.** Una tabla, una fórmula con un `max` entre dos opciones y un bucle. Cabe en
   una pizarra y no hace falta saber de informática: es el mismo razonamiento recursivo de "decido el
   último objeto y el resto es el mismo problema más pequeño".
4. **Es reutilizable.** El enunciado pide que sirva para futuros "golpes". Basta una función que reciba
   `(valores, volúmenes, capacidad)`, sin nada específico del museo.
5. **Da la solución, no solo el valor.** Con la recuperación hacia atrás sale la lista de objetos.

## El límite que debes decir tú antes de que te lo pregunten

La DP no es gratis: la tabla tiene `n · K` celdas, y **`K` no es pequeño en todos los datasets**.

El inventario completo está en `outputs/inventory.csv`. Estos son los casos que importan:

| Dataset | Objetos | Capacidad `K` | Celdas de la tabla (n · K) | Tabla a 1 byte por celda |
|---|---|---|---|---|
| `ks_1000_0` | 1.000 | 100.000 | 100 millones | 100 MB (cabe de sobra) |
| `ks_300_0` | 300 | 4.040.184 | 1.200 millones | 1,2 GB (cabe) |
| `ks_400_0` | 400 | 9.486.367 | 3.800 millones | 3,8 GB (justo, con riesgo) |
| `ks_82_0` | 82 | 104.723.596 | 8.600 millones | 8,6 GB (no cabe con comodidad) |
| `ks_106_0` | 106 | 106.925.262 | 11.300 millones | 11,3 GB (no cabe) |
| `ks_10000_0` | 10.000 | 1.000.000 | 10.000 millones | 10 GB (no cabe) |

Los otros 16 datasets tienen menos de 530 millones de celdas y la DP los resuelve al instante.
El enunciado habla de hasta 1.000 objetos, pero `K` llega a 10^8, y lo que manda es `n · K`, no `n`.

**Pruebas preliminares (por confirmar en el informe final).** Con la DP calculando solo el valor
(una fila, sin lista de objetos), `milp` con `mip_rel_gap=0` da el mismo óptimo que la DP en todos los
datasets probados. Dos avisos. Primero, `milp` por defecto tolera un 0,01% de error y en `ks_100_1` y
`ks_300_0` devolvía un valor algo menor que el óptimo, así que hay que fijar `mip_rel_gap=0`. Segundo,
su tiempo es impredecible: en `ks_60_0` y `ks_100_0` agotó el límite de 120 s sin poder demostrar que
su solución era óptima (aunque el valor era el correcto), mientras que la DP tarda 0,0 s. Al revés, en
`ks_82_0` y `ks_106_0` la DP tarda más de 80 s y `milp` menos de un segundo. Los dos métodos fallan en
sitios distintos, de ahí la idea de combinarlos según el tamaño. Estamos probando también el solver de
mochila de OR-Tools.

---

# Sobre `scipy.optimize` (corrección importante)

**`scipy.optimize` no tiene programación dinámica.** Es un módulo de optimización continua y lineal
(`minimize`, `linprog`, `curve_fit`...). No existe en él una función "mochila" ni nada que construya tablas
de DP. Lo único suyo que resuelve la mochila es `scipy.optimize.milp`, que es el modelo de programación
entera de arriba resuelto con ramificación y acotación (el solver HiGHS), **no DP**.

Qué propongo y por qué:

| Pieza | Herramienta | Por qué |
|---|---|---|
| La DP (método principal, el que se explica) | **NumPy** | La tabla es un array, y rellenar toda una fila es una línea (`np.maximum`) en vez de un bucle por capacidad |
| Comprobar que la DP está bien | **`scipy.optimize.milp`** | Resuelve el mismo problema por otro camino. Si ambos dan el mismo valor óptimo en los 22 datasets, la DP está validada |
| Tabla de resultados | **pandas** | Ya lo conoces; una fila por dataset |

Así usas SciPy como querías, pero para lo que sirve: la programación entera es justo lo que ya das en
ISyE, y que coincida con la DP es el mejor argumento de que el código es correcto. La DP en sí es código
nuestro, no una llamada a una librería.

Alternativa descartada: OR-Tools (Google) trae un solver de mochila directo, pero es un paquete grande
y oculta el algoritmo; justo lo contrario de lo que queremos poder explicar.

---

# `data.py`: leer los ficheros

## `load_instance(path)`

Lee un fichero `ks_*` y devuelve tres cosas: los valores, los volúmenes y la capacidad.

- `open(path)` y `f.readline().split()`: lee solo la primera línea y la parte por espacios, que da `n` y `K`.
- `np.loadtxt(path, skiprows=1, dtype=np.int64)`: lee el resto como una tabla de `n` filas y 2 columnas
  (`skiprows=1` salta la primera línea). `int64` porque algunos datasets tienen volúmenes de cientos de
  millones y la suma de volúmenes llega a mil millones.
- `tabla[:, 0]` son los valores y `tabla[:, 1]` los volúmenes.

## `inventory()`

Recorre `data/raw/`, carga cada fichero y arma una tabla de pandas con una fila por dataset: objetos,
capacidad, `celdas_tabla` (= objetos × capacidad, el tamaño de la tabla de DP) y volumen total. Al
ejecutar el fichero la imprime y la guarda en `outputs/inventory.csv`.

---

# Decisiones pendientes (para decidirlas juntos)

1. **Una versión de la DP o dos.** Una con bucles `for` anidados (la más fácil de contar, es la tabla
   de arriba), o la de NumPy (más rápida, una línea por objeto). Propongo la de NumPy con un comentario
   que enlace con la fórmula, comprobada contra el ejemplo a mano de arriba.
2. **Qué hacemos con los datasets donde la tabla no cabe** (ver la tabla de tamaños): intentarlo y
   documentar el límite con honestidad, o apoyarnos en `milp` para esos.
3. **Si guardamos el tiempo de ejecución por dataset** para comparar DP y `milp` en el informe.
