# Plan de revisión arquitectural — Metro

> Auditoría completa del repositorio (metro-sim Scala/Akka, metro Angular 21, metro-server Node.js)
> en cuatro vertientes: código no usado, duplicidades/fallbacks, cuellos de botella de simulación,
> y desperdicio de recursos / herramientas infrautilizadas.
>
> Fecha: 2026-05-03 · Branch base: `main`
> Wave 1 completada: 2026-05-04 (branch `chore/dead-code-purge`, PR mergeada)
> Wave 2 completada: 2026-05-05 (branch `perf/sim-bottlenecks-backend`, PR mergeada)

---

## Tabla de contenidos

- [A. Código no usado (pendiente)](#a-código-no-usado-pendiente)
- [B. Duplicidades y fallbacks innecesarios](#b-duplicidades-y-fallbacks-innecesarios)
- [C. Cuellos de botella de simulación (orden por impacto)](#c-cuellos-de-botella-de-simulación-orden-por-impacto)
- [D. Recursos infrautilizados / desperdicios](#d-recursos-infrautilizados--desperdicios)
- [Orden de ataque (waves)](#orden-de-ataque-waves)
- [Métricas para validar antes/después](#métricas-para-validar-antesdespués)

---

## A. Código no usado (pendiente)

### A1 — `metro-server/` completo (relay echo redundante)
- **Ubicación:** `metro-server/metro.js`
- **Diagnóstico:** Servidor de relay tipo echo que escucha en :8081 y reenvía mensajes. El simulador `metro-sim` ya sirve WebSocket en el mismo puerto con gestión completa de snapshot. El frontend conecta directamente al backend.
- **Bloqueante:** `docker-compose.yml` lo referencia como servicio; README lo menciona. Requiere decisión sobre si el docker-compose se actualiza para usar metro-sim directamente.
- **Acción:** Decidir si se elimina docker-compose o se adapta; luego borrar el directorio.

> **Completados en Wave 1:** A2 (circe deps), A4 (provideAnimationsAsync), A5 (ActorContext import), A6 (REDRAW_PERIOD_MS), A8 (FooterComponent), A9 (L*.json legacy files)
> **Descartados:** A3 (geolatte-geom-scala se usa para GeometryImplicits), A7 (los 5 tipos de mensaje sí se usan en el panel de KPIs del frontend)

---

## B. Duplicidades y fallbacks innecesarios

### B1 — Proyección Mercator duplicada Scala ↔ TypeScript
- **Ubicación:** `metro-sim/src/main/scala/utils/Position.scala:6-17` y `metro/src/app/position.ts:1-17`
- **Diagnóstico:** Misma matemática (lat/lon → canvas X/Y), constantes hardcoded duplicadas:
  - Centro Madrid: `40.4202961, -3.718762`
  - Radio: `6371000`
  - Width 3400 / Height 2000
  - El frontend acepta `width/height` por parámetro mientras el backend los hardcodea.
- **Riesgo:** Si alguien cambia el centro/radio/extent en un sitio y olvida el otro → desincronización silenciosa entre coordenadas calculadas en backend (para estaciones/plataformas) y las dibujadas en frontend.
- **Acción propuesta:**
  - Opción A (mínima): mover las 4 constantes a `data/projection.json`, ambos lados leen de ahí.
  - Opción B (mejor): backend genera `data/madrid/projection.json` con `{ lambda0, phi0, radius, cosP1, width, height }` durante el build. Frontend importa este JSON estático.

### B2 — Normalización NFD reimplementada en 4 sitios del frontend
- **Ubicación:** `metro/src/app/train/train.component.ts:121-122, 650-651, 671-672, 1216-1218`
- **Patrón duplicado:**
  ```typescript
  s.name.normalize('NFD').replace(/\p{Mn}/gu, '')
  ```
- **Diagnóstico:** Replica `Metro.stationName`/`Metro.platformName` del backend (`Metro.scala:104-114`) que usa `Normalizer.Form.NFD` + regex `\p{InCombiningDiacriticalMarks}+`.
- **Acción:** Crear `metro/src/app/utils/station-naming.ts` con dos funciones:
  ```typescript
  export function normalizeName(s: string): string { ... }
  export function parseStationId(id: string): { name: string; code: string } { ... }
  export function parsePlatformId(id: string): { name: string; anden: string } { ... }
  ```
  Reemplazar las 4 ocurrencias inline.

> **Completados en Wave 1:** B3 (platformId → platformCode en Person.scala), B4 (fallbacks ?? '' eliminados en train.component.ts)

---

## C. Cuellos de botella de simulación (orden por impacto)

### C1 — Lookup O(n) por cada nodo de cada path de cada persona ★★★★★
- **Ubicación:** `Simulator.scala:122-124`
  ```scala
  path = journey.get.nodes
    .map(x => stationActors.filter(y => y.path.name == x.name).head)
    .toSeq
  ```
- **Coste actual:** O(K × path_len × N), donde K=personas/tick, path_len≈10, N=#estaciones+#plataformas≈500-1000. Con K=100 personas/tick → ~500.000 escaneos lineales por tick (cada 10 s).
- **Fix:** Pre-construir una vez en `Guardian` (Main.scala) y pasar al `Simulator`:
  ```scala
  val actorsByName: Map[String, ActorRef[_]] =
    (stationActors.values ++ allPlatformActors.values)
      .map(a => a.path.name -> a).toMap
  ```
  Reemplazar `.filter(...).head` por `actorsByName(x.name)`.
- **Estimación de mejora:** -90% CPU del paso de spawning.

### C2 — Mismo patrón en construcción del grafo ★★★★
- **Ubicación:** `Metro.scala:52, 56, 59, 61, 83`
  ```scala
  currentStation = stations.filter(x => x.name == currentStationName).head
  currentPlatform = platforms.filter(x => x.name == currentPlatformName).head
  ```
- **Coste:** O(n) × cientos de iteraciones durante `buildMetroGraph()`. Solo una vez al arranque, pero alarga el startup.
- **Fix:** Construir mapas previamente:
  ```scala
  val stationsByName: Map[String, MetroNode] = stations.map(s => s.name -> s).toMap
  val platformsByName: Map[String, MetroNode] = platforms.map(p => p.name -> p).toMap
  ```
- **Estimación:** Arranque más rápido (segundos), código más legible.

### C3 — `shortestPathTo` re-ejecutado por cada persona ★★★★
- **Ubicación:** `Simulator.scala:121`
  ```scala
  journey: Option[metroGraph.Path] = startNode.shortestPathTo(destinationNode, ...)
  ```
- **Coste:** Dijkstra O((V+E) log V) ejecutado una vez por persona spawneada. Origen y destino son del orden de 250 estaciones cada uno, así que pares (origen, destino) se repiten masivamente.
- **Fix:** Cache LRU por `(origenName, destinoName)`:
  ```scala
  private val pathCache = new java.util.LinkedHashMap[(String, String), Seq[ActorRef[_]]](
    1024, 0.75f, true) {
      override def removeEldestEntry(eldest: ...) = size() > 5000
    }
  ```
  o un simple `mutable.Map` con eviction periódico.
- **Estimación:** ~99% de cache hits → reducción dramática de CPU en spawning.

### C4 — `path.indexWhere(...)` en cada transición de Person ★★★
- **Ubicación:** `Person.scala:42, 176`
  ```scala
  def nextNodeIndex(currentRef: ActorRef[_]): Int =
    path.indexWhere(_.path.name == currentRef.path.name) + 1
  ```
- **Coste:** O(path_len) × 5-15 transiciones por persona × N personas concurrentes. Con 10 K personas y paths de 10 nodos: ~100 K-500 K operaciones por ciclo de actualización.
- **Fix:** Mantener `var pathIndex: Int = 0` como estado mutable en el Person actor; incrementar en lugar de re-escanear:
  ```scala
  var currentIdx = 0
  def advance(): Unit = { currentIdx += 1 }
  def nextNode: ActorRef[_] = path(currentIdx + 1)
  ```
- **Estimación:** Reduce CPU de Person actors significativamente.

### C5 — Cada Train recibe `allPaths: Seq[Path]` (≈3 MB × 200 trenes ≈ 600 MB) ★★★
- **Ubicación:** `Train.scala:23` (constructor)
  ```scala
  def apply(ui: ActorRef[UIMessage], allPaths: Seq[Path]): Behavior[TrainMessage] = ...
  ```
- **Coste:** Aunque Scala pasa por referencia (no copia), cada actor mantiene su propio `pathByName: Map[String, Path]` derivado:
  ```scala
  val pathByName: Map[String, Path] = allPaths.map { pp => ... }.toMap
  ```
  Eso sí se materializa una vez por actor → 200 mapas duplicados.
- **Fix:** Construir `pathByName` una sola vez en `Guardian` y pasarlo ya construido a cada `Train`:
  ```scala
  val pathByName: Map[String, Path] = allPaths.map(...).toMap  // una sola vez
  context.spawn(Train(ui, pathByName), uuid)
  ```
- **Estimación:** -200 mapas duplicados ≈ ahorro de 100-300 MB.

### C6 — Frontend sin OnPush — change detection completo en cada msg WS ★★★★
- **Ubicación:** `metro/src/app/train/train.component.ts:12-18` y otros componentes
- **Diagnóstico:** Sin `ChangeDetectionStrategy.OnPush`. Con 100+ mensajes WS/s, Angular ejecuta CD en todo el árbol cada vez.
- **Fix:**
  1. Añadir `changeDetection: ChangeDetectionStrategy.OnPush` al decorador `@Component`.
  2. Inyectar `ChangeDetectorRef` y llamar `cdr.markForCheck()` o `cdr.detectChanges()` solo cuando `state.dirty` flag se ponga a true.
  3. El RAF loop ya tira de canvas directo, no necesita CD para repintar.
- **Estimación:** Estabilizar 60 FPS bajo carga (>100 trenes).

### C7 — `drawTrains()` recalcula `positionAtArc()` por cada vagón en cada RAF ★★★
- **Ubicación:** `train.component.ts:780` (función `positionAtArc`)
- **Diagnóstico:** Con ~8 vagones por tren y 100 trenes → 800 búsquedas binarias por frame (60 FPS = 48 K/s).
- **Fix:** Memoizar la posición del cabezal del tren por (`trainId`, `frameTimestamp`); calcular vagones como offset desde la posición del cabezal:
  ```typescript
  private trainHeadCache = new Map<string, { x: number; y: number; heading: number; t: number }>();
  ```
  Solo invalidar cuando `train.departedAt` cambie.

### C8 — `computeLabelVisibility()` O(n²) en estaciones ★★
- **Ubicación:** `train.component.ts:432-454`
- **Diagnóstico:** Para cada estación (n≈250) comprueba solapes contra todas las anteriores ya colocadas. Re-ejecutado en cada cambio de zoom.
- **Fix:**
  - Quadtree espacial (>1000 elementos lo justifica; con 250 quizás overkill).
  - Cache por nivel de zoom: `Map<number, boolean[]>` indexado por `Math.floor(zoom * 10)`.
- **Estimación:** Zoom más fluido.

### C9 — WebSocket: ~10+ broadcasts/s × N clientes; sin batching ★★★
- **Ubicación:** `utils/WebSocket.scala:85-89` (broadcast); llamadas desde `UI.scala:25, 27, 29, 35`
- **Diagnóstico:** Cada `sendStat`, `sendTrain`, etc. itera todas las conexiones y serializa JSON individualmente.
- **Fix:** Batch:
  ```scala
  private val pending = scala.collection.mutable.Map[String, String]()
  def sendStatBatched(key: String, json: String) = synchronized { pending(key) = json }
  // Timer cada 200 ms: emite todos los pending acumulados como un único payload
  ```
- **Estimación:** -90% mensajes WS, menos CPU de serialización, menos eventos JS en el cliente.

### C10 — `WebSocket.connections.filterNot(...)` en disconnect ★ (menor)
- **Ubicación:** `utils/WebSocket.scala:36`
- **Fix:** Cambiar `Seq` por `mutable.Map[String, SourceQueueWithComplete[Message]]`. Lookup y borrado O(1).

---

## D. Recursos infrautilizados / desperdicios

### D1 — `scribe.debug(s"...")` en hot paths sin guard
- **Ubicación:** `Train.scala:71, 78, 87, 96, 125, 130, 147` (también `Person.scala`, `Platform.scala`)
- **Diagnóstico:** `s"..."` interpola siempre, aunque el log esté a INFO (`Main.scala:32`). Coste menor pero acumulado.
- **Fix opciones:**
  - Sustituir por log4s/scala-logging que tienen macros lazy.
  - Guard manual: `if (scribe.Logger.root.minimumLevel <= Level.Debug) scribe.debug(...)`.
  - Eliminar los más calientes (cada movimiento de tren).

### D2 — Lectura síncrona de JSONs en main thread al arranque
- **Ubicación:** `Main.scala:42, 46, 56, 70-72`
- **Diagnóstico:** 5 ficheros JSON leídos con `scala.io.Source.fromFile(...).mkString` bloqueando el hilo principal antes de iniciar el actor system.
- **Fix:** Mover a un dispatcher dedicado:
  ```hocon
  blocking-io-dispatcher {
    type = Dispatcher
    executor = "thread-pool-executor"
    thread-pool-executor.fixed-pool-size = 2
  }
  ```
  Wrap con `Future` en `blocking-io-dispatcher`.

### D3 — Comandos WS parseados con regex/string-split a mano
- **Ubicación:** `Main.scala:91-134`
- **Diagnóstico:**
  ```scala
  val factor = text.split("\"factor\"\\s*:\\s*").drop(1).headOption
    .flatMap(_.trim.takeWhile(c => c.isDigit || c == '.').toDoubleOption)
  ```
  Frágil, no valida tipos, no maneja JSON anidado. Play JSON ya está en `build.sbt`.
- **Fix:**
  ```scala
  sealed trait Command
  case class SetSpeed(factor: Double) extends Command
  case class TrackPerson(personId: String) extends Command
  // ...
  implicit val cmdReads: Reads[Command] = ...
  Json.parse(text).validate[Command] match { ... }
  ```

### D4 — Sin tuning Akka (throughput / dispatcher)
- **Ubicación:** `metro-sim/src/main/resources/application.conf:2` (solo `time-multiplier=10`)
- **Fix:**
  ```hocon
  pekko {
    actor {
      default-dispatcher {
        throughput = 10
        executor = "thread-pool-executor"
        thread-pool-executor {
          core-pool-size-min = 4
          core-pool-size-factor = 1.0
          max-pool-size = 32
        }
      }
    }
  }
  ```
  Ajustar `throughput=10` significa que cada thread procesa 10 mensajes seguidos antes de ceder, mejor para flujos masivos.

### D5 — `peopleHistory = [...slice(1), ...]` reasigna array cada 200 ms
- **Ubicación:** `train.component.ts:374`
- **Fix:** Buffer circular:
  ```typescript
  private peopleHistory = new Float32Array(40);
  private peopleHistoryIdx = 0;
  pushPeople(value: number) {
    this.peopleHistory[this.peopleHistoryIdx] = value;
    this.peopleHistoryIdx = (this.peopleHistoryIdx + 1) % 40;
  }
  ```

### D7 — `retry()` WebSocket sin timeout ni `takeUntilDestroyed()`
- **Ubicación:** `metro/src/app/services/websocket.service.ts:30-37`
- **Fix:**
  ```typescript
  this.messages$ = this.socket$.pipe(
    timeout({ first: 30_000 }),
    retry({ delay: () => timer(2000), count: 30 }),
    takeUntilDestroyed(this.destroyRef),
  );
  ```

### D8 — `stationLabelItems` getter normaliza ~300 nombres en cada CD cycle
- **Ubicación:** `train.component.ts:1211-1220`
- **Fix:** Memoizar en `ngOnInit`:
  ```typescript
  private cachedStationLabelItems: StationLabelItem[] = [];
  ngOnInit() { this.cachedStationLabelItems = this.computeStationLabelItems(); }
  get stationLabelItems() { return this.cachedStationLabelItems; }
  ```

### D9 — Falta scalafmt / scalafix
- **Ubicación:** `metro-sim/project/plugins.sbt`
- **Acción:**
  ```scala
  addSbtPlugin("org.scalameta" % "sbt-scalafmt" % "2.5.2")
  addSbtPlugin("ch.epfl.scala" % "sbt-scalafix" % "0.12.1")
  ```
  Crear `.scalafmt.conf` con reglas mínimas. Útil para CI.

### D10 — Sin `sbt-assembly` (despliegue requiere `sbt run`)
- **Ubicación:** `metro-sim/project/plugins.sbt`
- **Acción:**
  ```scala
  addSbtPlugin("com.eed3si9n" % "sbt-assembly" % "2.1.5")
  ```
  Configurar `assembly / mainClass := Some("Main")` en `build.sbt`. Despliegue: `java -jar metro-sim.jar`.

> **Completados en Wave 1:** D6 (tileCache reducido de 300 a 128)

---

## Orden de ataque (waves)

### ~~Wave 1~~ — completada (branch `chore/dead-code-purge`)
A2, A4, A5, A6, A8, A9, B3, B4, D6 ✓

### ~~Wave 2~~ — completada (branch `perf/sim-bottlenecks-backend`)
C1, C2, C3, C4 ✓

### Wave 3 — perf frontend (medio día)
**Items:** C6, C7, C8
**Resultado esperado:** 60 FPS estables con 100+ trenes. Reducción de Long Tasks en DevTools.
**Branch sugerida:** `perf/frontend-render`
**Validación:** Chrome DevTools Performance tab; medir FPS y CPU del worker.

### Wave 4 — calidad / robustez (1 día)
**Items:** A1, B1, B2, C5, C9, C10, D1, D2, D3, D4, D5, D7, D8
**Resultado esperado:** Menos memoria (-100 MB), startup más rápido, mensajería WS más eficiente, parsing robusto.
**Branch sugerida:** `refactor/quality-pass`

### Wave 5 — tooling (opcional, 2-3 h)
**Items:** D9, D10
**Resultado esperado:** CI con format check, despliegue con un solo `java -jar`.
**Branch sugerida:** `chore/tooling`

---

## Métricas para validar antes/después

### Backend
- **CPU del paso de spawning** (`Simulator.scala:101 SimulateStep`): instrumentar con `System.nanoTime()` antes/después del `for` block. Loguear ms cada N pasos.
- **RAM total proceso JVM**: `jcmd <pid> VM.native_memory summary` antes/después de Wave 4.
- **#Mensajes WS/s**: contador en `WebSocket.broadcast` antes/después de C9.
- **Tiempo de arranque**: desde `sbt run` hasta `Listening at ...`.

### Frontend
- **FPS**: Chrome DevTools Performance tab durante 30 s con 100 trenes. Antes / después de Wave 3.
- **CPU%** del proceso renderer: misma medida.
- **Memoria heap JS**: DevTools Memory snapshot.
- **Tamaño del bundle**: `npm run build` → comparar `main.js` antes/después de A4 y A7.

### Validaciones funcionales (no romper nada)
- `npm test -- --watch=false --browsers=ChromeHeadless` debe pasar (40/40).
- `sbt compile` sin warnings nuevos.
- Path debug `/debug` con Empalme→Batán debe seguir devolviendo 9 nodos vía Platform_420.
- Visualización del pasajero rastreado debe seguir respetando el fix anterior (no pasa por Colonia Jardín).
