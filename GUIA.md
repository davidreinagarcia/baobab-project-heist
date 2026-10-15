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
| `src/heist/knapsack.py` | Resuelve una mochila con el solver de programación dinámica de OR-Tools | `resolver()` | hecho |
| `src/heist/run_all.py` | Lanza el solver en los 22 datasets, comprueba el resultado y guarda valor, tiempo y objetos | `main()` | hecho |

Se lanza con `.venv/bin/python -m src.heist.data` (escribe `outputs/inventory.csv`) y con
`.venv/bin/python -m src.heist.run_all` (escribe `outputs/results.csv` y `outputs/solutions/`).

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

**Lo que midió OR-Tools (resultados reales de `run_all.py`).** Su solver de DP no necesitó la tabla
completa de `n · K` celdas: con un tope de 4 GB de memoria resolvió los 22 datasets con óptimo
certificado (`is_solution_optimal()` es `True` en todos). Los más lentos son `ks_10000_0` (53 s),
`ks_106_0` (29 s), `ks_82_0` (13 s) y `ks_400_0` (13 s); los otros 18 tardan menos de 6 s. Por eso
ya no hace falta tratar aparte los datasets "donde la tabla no cabe".

---

# Por qué OR-Tools y no una DP escrita a mano

Decisión tomada: usamos `KNAPSACK_DYNAMIC_PROGRAMMING_SOLVER` de OR-Tools. La DP de las secciones
anteriores sigue siendo la explicación de **qué hace** el solver por dentro; no la reescribimos porque
el solver ya la implementa en C++, es exacto y cubre los 22 datasets sin problemas de memoria.

Se probó también `KNAPSACK_MULTIDIMENSION_BRANCH_AND_BOUND_SOLVER`, el otro solver de mochila de OR-Tools:
es instantáneo en casi todos, pero falla con `bad_alloc` (sin memoria) en `ks_82_0` y `ks_106_0`, y en
`ks_100_0` no consigue demostrar el óptimo en 60 s (aunque el valor era el correcto). Por eso la DP es
la opción segura. Los valores de ambos coinciden en todos los datasets donde los dos terminan.

---

# `knapsack.py` y `run_all.py`

## `resolver(values, volumes, capacity)`

Crea el solver de DP, le da los datos y devuelve `(valor_total, elegidos, optimo)`.

- `KnapsackSolver(SolverType.KNAPSACK_DYNAMIC_PROGRAMMING_SOLVER, ...)`: elige el algoritmo de DP.
- `set_time_limit(600)`: corta a los 10 minutos; si se agota, `optimo` sale `False`.
- `init(valores, [volumenes], [capacidad])`: los volúmenes y la capacidad van en listas porque el
  solver admite varias restricciones a la vez (una mochila con peso Y volumen, por ejemplo).
- `solve()` devuelve el valor máximo; `best_solution_contains(i)` dice si el objeto `i` se coge.
- Todo son enteros: los ficheros ya lo son (si no, habría que multiplicar por una potencia de 10).

## `main()` de `run_all.py`

Para cada fichero: carga, resuelve, mide el tiempo y comprueba por su cuenta (sin fiarse del solver) que
el volumen de lo cogido no pasa de `K` y que la suma de valores coincide. Guarda `outputs/results.csv` y,
por dataset, `outputs/solutions/<fichero>`: primera línea `valor optimo(1/0)`, segunda línea un 0/1 por objeto.

---

# `data.py`: leer los ficheros

## `load_instance(path)`

Lee un fichero `ks_*` y devuelve tres cosas: los valores, los volúmenes y la capacidad.

- `open(path)` y `f.readline().split()`: lee solo la primera línea y la parte por espacios, que da dos
  textos (`n` y `K`). Nos quedamos con el segundo, `int(primera_linea[1])`, que es la capacidad.
- `np.loadtxt(path, skiprows=1, dtype=np.int64)`: lee el resto como una tabla de `n` filas y 2 columnas
  (`skiprows=1` salta la primera línea). `int64` porque algunos datasets tienen volúmenes de cientos de
  millones y la suma de volúmenes llega a mil millones.
- `tabla[:, 0]` son los valores y `tabla[:, 1]` los volúmenes.

## `inventory()`

Recorre `data/raw/`, carga cada fichero y arma una tabla de pandas con una fila por dataset: objetos,
capacidad, `celdas_tabla` (= objetos × capacidad, el tamaño de la tabla de DP) y volumen total. Al
ejecutar el fichero la imprime y la guarda en `outputs/inventory.csv`.

---

# Preguntas de discusión: ¿es este el método óptimo? ¿habría algo mejor?

**Respuesta corta.** Para estos 22 datasets, sí: es exacto (óptimo demostrado en todos) y el peor caso
tarda 53 s. Para instancias mucho más grandes o distintas, hay alternativas, y conviene saber cuándo.

**Qué es "óptimo" aquí.** Dos cosas distintas: óptimo en *solución* (el valor es el máximo posible, que
la DP garantiza) y óptimo en *eficiencia* (el algoritmo más rápido posible). La primera la cumplimos. La
segunda no se pretende: la DP es pseudopolinómica, `n · K`, y crece con la capacidad.

**Alternativas, y cuándo ganan**

| Método | Idea | Cuándo gana a la DP |
|---|---|---|
| Algoritmos de núcleo (Expknap, Minknap, Combo de Pisinger y Martello) | Resuelven solo un "núcleo" pequeño de objetos alrededor del punto donde se llena la mochila al ordenar por valor/volumen; el núcleo crece solo si la instancia es difícil | Muchos objetos y `K` enorme. Son el estado del arte para mochila 0/1 exacta, Combo es el más citado |
| Ramificación y acotación (branch and bound) | Explora un árbol de decisiones y descarta ramas que no pueden mejorar | Capacidad enorme, donde la tabla de DP es inmanejable. En nuestra prueba fue instantáneo en casi todo, pero su tiempo es impredecible (falló en 2 datasets y en otro no certificó el óptimo) |
| Esquema de aproximación (FPTAS) | Reduce la escala de los valores y aplica DP: garantiza al menos `(1 - ε) · óptimo` en tiempo `O(n² / ε)` | Cuando basta una solución casi óptima y `K` o los valores son gigantescos |
| Meet in the middle | Parte los objetos en dos mitades y combina las listas de sumas: `O(2^(n/2))` | Pocos objetos (hasta unos 40) y `K` astronómica; con 82 o más objetos ya no sirve |
| Programación entera / CP-SAT | Modelo genérico con un solver de propósito general | Cuando la mochila tiene condiciones extra (conflictos entre objetos, varias mochilas); para la mochila simple suele perder contra algoritmos específicos |

**Una matización honesta.** Hay literatura que reporta solvers genéricos (incluido OR-Tools) que no
terminaban en instancias de mochila muy grandes donde Combo sí lo hacía. Nosotros no hemos llegado a ese
límite con estos datos, pero si el dataset creciera a millones de objetos o a capacidades de 10^10,
Combo o un FPTAS serían las respuestas.

**Cómo se adaptaría a otros casos**
- Valores o volúmenes decimales: multiplicar por una potencia de 10 y trabajar con enteros.
- Más de una restricción (peso y volumen): el solver ya admite listas de restricciones, pero deja de ser
  tan eficiente, el problema pasa a ser mochila multidimensional.
- Objetos incompatibles entre sí (conflictos): el problema pasa a ser fuertemente NP-difícil y deja de
  existir una DP pseudopolinómica; hay que pasar a programación entera o CP-SAT.
- Si se pudieran coger fracciones de objeto: el voraz por valor/volumen es óptimo (mochila continua).
