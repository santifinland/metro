// Metro. SDMT
// Discrete-Event Simulation clock.
//
// Replaces Akka wall-clock timers with a priority-queue event loop that runs
// purely in simulation time. One dedicated daemon thread advances simTimeMs by
// speedFactor for every real millisecond elapsed, firing all events whose
// scheduled time has been reached.
//
// Usage from any thread (actor or otherwise):
//   SimClock.scheduleIn(delaySimMs) { () => someActor ! SomeMessage }
//   SimClock.scheduleAt(absSimMs)   { () => someActor ! SomeMessage }
//
// Speed is expressed as "sim-milliseconds per real-millisecond":
//   speedFactor = 10  → simulation runs 10× faster than real time
//   speedFactor = 100 → 100× faster (100 sim-seconds per real-second)

object SimClock {

  // ── Event ────────────────────────────────────────────────────────────────

  private final class Event(val atSimMs: Long, val run: () => Unit)
    extends Comparable[Event] {
    def compareTo(other: Event): Int = java.lang.Long.compare(atSimMs, other.atSimMs)
  }

  // ── State ────────────────────────────────────────────────────────────────

  private val queue = new java.util.concurrent.PriorityBlockingQueue[Event]()

  @volatile private var _simTimeMs: Long   = 6L * 3600L * 1000L  // starts at 06:00
  @volatile private var _speedFactor: Double = 10.0               // default: 10× real time
  @volatile private var _running: Boolean  = false

  def simTimeMs:   Long   = _simTimeMs
  def speedFactor: Double = _speedFactor

  // ── Public API ───────────────────────────────────────────────────────────

  /** Schedule a callback at an absolute simulation time. */
  def scheduleAt(atSimMs: Long)(run: () => Unit): Unit =
    queue.offer(new Event(atSimMs, run))

  /** Schedule a callback at simNow + delaySimMs. */
  def scheduleIn(delaySimMs: Long)(run: () => Unit): Unit =
    scheduleAt(_simTimeMs + delaySimMs)(run)

  /** Change simulation speed. Thread-safe; takes effect on next tick. */
  def setSpeed(factor: Double): Unit = {
    _speedFactor = factor.max(0.1).min(10_000.0)
  }

  /** Reset simulation clock to 06:00 and clear pending events. */
  def reset(): Unit = {
    queue.clear()
    _simTimeMs = 6L * 3600L * 1000L
  }

  // ── Event loop ───────────────────────────────────────────────────────────

  def start(): Unit = {
    _running = true
    val thread = new Thread(() => {
      var lastRealMs = System.currentTimeMillis()
      while (_running) {
        val nowMs      = System.currentTimeMillis()
        val realDelta  = (nowMs - lastRealMs).max(0L)
        lastRealMs     = nowMs

        val targetSimMs = _simTimeMs + (realDelta * _speedFactor).toLong

        // Fire all events due by targetSimMs
        var continue = true
        while (continue) {
          val next = queue.peek()
          if (next != null && next.atSimMs <= targetSimMs) {
            queue.poll()
            _simTimeMs = next.atSimMs
            try { next.run() }
            catch { case ex: Throwable => scribe.error(s"SimClock event error: $ex") }
          } else {
            continue = false
          }
        }
        _simTimeMs = targetSimMs

        Thread.sleep(1)
      }
    }, "sim-clock")
    thread.setDaemon(true)
    thread.start()
    scribe.info(s"SimClock started at speedFactor=${_speedFactor}×")
  }

  def stop(): Unit = { _running = false }
}
