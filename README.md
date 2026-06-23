# 🎲 Catanalike - Catan Autoplay & Real-Time Multiplayer Web App

¡Bienvenido a **Catanalike**! Esta es una implementación moderna y completamente jugable del clásico juego de mesa **Catan (Colonos de Catan)**, construida con una arquitectura cliente-servidor en tiempo real, soporte para jugadores artificiales (Bots inteligentes) y una interfaz de usuario inmersiva con estilo *glassmorphic*.

El proyecto cuenta con un modo de juego manual y simulación automática de partidas (Autoplay con bots).

---

## ✨ Características Principales

### 1. Tablero Dinámico y Puertos
- **Generación Procedural:** Tablero hexagonal clásico de 19 casillas con distribución aleatoria de recursos (Madera, Arcilla, Trigo, Oveja, Mineral y Desierto) y números de producción.
- **9 Puertos Marítimos:** Ubicados y orientados simétricamente en el borde exterior del tablero.
  - Puertos de recurso específico (tasa de intercambio 2:1).
  - Puertos genéricos (tasa de intercambio 3:1).
  - El sistema detecta automáticamente la posesión de poblados/ciudades en los vértices del puerto y aplica las tasas dinámicas al comerciar con la banca.

### 2. Lógica Avanzada del Ladrón (Robber)
- Se activa al salir un **7 en la tirada de dados** o al jugar una carta de **Caballero**.
- **Descarte de Cartas:** Si un jugador (humano o bot) tiene más de 7 cartas en mano al salir un 7, descarta automáticamente y de forma aleatoria la mitad de sus recursos.
- **Movimiento e Interacción:** El jugador activo recoloca al ladrón en cualquier hexágono que no esté bloqueado actualmente.
- **Robo en Caliente:** Si el hexágono seleccionado tiene poblados o ciudades de oponentes, el jugador activo puede elegir a cuál de ellos robarle una carta de recurso aleatoria.

### 3. Cartas de Desarrollo con Reglas Oficiales
- Compra de cartas usando 🌾 (Trigo), 🐑 (Oveja) y 🪨 (Mineral).
- **Cartas soportadas:** Caballero, Monopolio, Año de Abundancia, Construcción de Carreteras y Puntos de Victoria.
- **Puntos de Victoria Privados:** Las cartas de Puntos de Victoria se computan en tu puntaje de manera privada y oculta. Los oponentes solo ven tus puntos públicos basados en estructuras y logros, hasta que alcances los 10 puntos reglamentarios para ganar.
- **Restricción de Compra/Uso:**
  - Solo se puede jugar un máximo de **1 carta de desarrollo por turno**.
  - **No se puede jugar una carta en el mismo turno en que fue comprada** (excepto las cartas de Puntos de Victoria, que se aplican pasivamente). La interfaz deshabilita los botones de juego y muestra un tooltip explicativo.

### 4. Tarjetas Especiales de Logro
- **Mayor Ruta Comercial (Longest Road):** Otorga **+2 Puntos de Victoria** al primer jugador que alcance 5 o más caminos consecutivos. Se calcula dinámicamente mediante búsqueda en profundidad (DFS). Un camino puede verse interrumpido por asentamientos de oponentes.
- **Mayor Ejército (Largest Army):** Otorga **+2 Puntos de Victoria** al primer jugador que juegue 3 o más cartas de Caballero.
- **Traspaso Dinámico:** Ambos logros son disputados en tiempo real; si un jugador supera la cantidad del poseedor actual, la tarjeta (y sus puntos) son transferidos al instante.

### 5. Bots con Inteligencia Artificial (IA)
- Los bots toman decisiones lógicas basadas en prioridades y pesos matemáticos:
  - Construyen poblados en intersecciones de alto rendimiento numérico.
  - Compran y juegan cartas de desarrollo estratégicamente.
  - Ofrecen y aceptan intercambios de recursos (evalúan si les conviene la oferta y si tienen excedentes).
  - Mueven al ladrón al hexágono con mayor producción acumulada de sus rivales.
- Puedes llenar la partida completa con bots para simular una partida automatizada de inicio a fin (*Autoplay*).

### 6. Pantalla de Fin de Partida y Estadísticas
- Al terminar la partida, un overlay elegante muestra:
  - **Premios Especiales:** Medallas al *Gran Agricultor* (más recursos recolectados), *Erudito de las Cartas* (más compras de cartas), *Gran General* (mayor ejército) y *Gran Arquitecto* (ruta más larga).
  - **Estadísticas de Dados:** Gráfico de barras horizontales detallando la cantidad y porcentaje de veces que salió cada número en la partida.
  - **Volver a la Sala:** El host puede restablecer la partida para volver al lobby de espera con los mismos jugadores y bots listos para otra ronda.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 18, Vite, Socket.io-client, CSS Vanilla (diseño responsive, efectos de desenfoque *backdrop-filter*, gradientes modernos y animaciones fluidas).
- **Backend:** Node.js, Express, Socket.io (comunicación bidireccional mediante eventos de sockets en tiempo real).

---

## ⚙️ Instalación y Configuración Local

Sigue estos pasos para correr la aplicación localmente en tu máquina:

### 1. Clonar el repositorio
```bash
git clone https://github.com/gastu9372/Catanalike.git
cd Catanalike
```

### 2. Configurar el Servidor (Backend)
1. Navega a la carpeta del servidor:
   ```bash
   cd server
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor en modo desarrollo (corre en el puerto `3001`):
   ```bash
   npm run dev
   ```

### 3. Configurar el Cliente (Frontend)
1. Abre una nueva terminal y navega a la carpeta del cliente:
   ```bash
   cd client
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo de Vite (normalmente corre en `http://localhost:5173`):
   ```bash
   npm run dev
   ```

---

## 🎮 Cómo Jugar una Partida

1. Abre tu navegador en `http://localhost:5173`.
2. Ingresa tu nombre y haz clic en **Crear Sala**.
3. Copia el código de sala de 4 letras que aparece arriba a la derecha si deseas que otros jugadores humanos se unan desde sus navegadores (o abre otra pestaña de incógnito).
4. Para jugar solo, haz clic en **Añadir Bot** hasta completar la sala (máximo 4 jugadores en total).
5. Haz clic en **Comenzar Partida**.
6. Coloca tus asentamientos iniciales y disfruta de la partida clásica.
