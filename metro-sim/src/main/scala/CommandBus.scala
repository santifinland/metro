// Metro. SDMT
// Thin singleton for routing commands from the WebSocket handler to the actor tree.
// The WebSocket handler runs outside the actor system, so we use a registered callback
// to bridge into the typed actor world without introducing shared mutable actor refs.

object CommandBus {

  @volatile private var _resetHandler: () => Unit = () => ()

  /** Register the function to call when a reset command arrives. Called once at startup. */
  def onReset(f: () => Unit): Unit = { _resetHandler = f }

  /** Trigger a full simulation reset. Delegates to the registered handler. */
  def fireReset(): Unit = _resetHandler()
}
