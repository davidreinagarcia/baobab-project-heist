"""El ladron audaz: resuelve la mochila 0/1 con el solver de programacion dinamica de OR-Tools."""
import numpy as np
from ortools.algorithms.python import knapsack_solver

# Si el solver no termina en 10 minutos, devuelve la mejor mochila que haya encontrado
# (y avisa de que no esta demostrado que sea la mejor posible)
TIEMPO_MAX = 600


def resolver(values, volumes, capacity):
    # 1. Crear el solver y elegir el algoritmo: programacion dinamica
    solver = knapsack_solver.KnapsackSolver(
        knapsack_solver.SolverType.KNAPSACK_DYNAMIC_PROGRAMMING_SOLVER, "heist"
    )
    solver.set_time_limit(TIEMPO_MAX)

    # 2. Darle los datos. Los volumenes y la capacidad llevan una fila (y una posicion) por
    #    restriccion, porque el solver admite varias a la vez (peso y volumen, por ejemplo);
    #    aqui solo hay una.
    solver.init(values, np.array([volumes]), np.array([capacity]))

    # 3. Resolver: devuelve el dinero maximo que cabe en la mochila
    valor = int(solver.solve())

    # 4. Preguntarle objeto por objeto si lo ha cogido: un True/False por objeto
    n = len(values)
    cogidos = np.fromiter((solver.best_solution_contains(i) for i in range(n)), dtype=bool, count=n)

    # 5. Tambien dice si ha podido demostrar que ese valor es el maximo posible
    optimo = solver.is_solution_optimal()
    return valor, cogidos, optimo
