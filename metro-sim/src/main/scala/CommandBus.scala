// Metro. SDMT
// Thin singleton for routing commands from the WebSocket handler to the actor tree.
// The WebSocket handler runs outside the actor system, so we use a registered callback
// to bridge into the typed actor world without introducing shared mutable actor refs.

object CommandBus {

  @volatile private var _resetHandler: () => Unit = () => ()
  @volatile private var _requestTrainPersonsHandler: String => Unit = _ => ()
  @volatile private var _requestPlatformPersonsHandler: String => Unit = _ => ()
  @volatile private var _trackPersonHandler: String => Unit = _ => ()
  @volatile private var _untrackPersonHandler: () => Unit = () => ()

  def onReset(f: () => Unit): Unit                      = { _resetHandler = f }
  def onRequestTrainPersons(f: String => Unit): Unit    = { _requestTrainPersonsHandler = f }
  def onRequestPlatformPersons(f: String => Unit): Unit = { _requestPlatformPersonsHandler = f }
  def onTrackPerson(f: String => Unit): Unit            = { _trackPersonHandler = f }
  def onUntrackPerson(f: () => Unit): Unit              = { _untrackPersonHandler = f }

  def fireReset(): Unit                            = _resetHandler()
  def fireRequestTrainPersons(id: String): Unit    = _requestTrainPersonsHandler(id)
  def fireRequestPlatformPersons(id: String): Unit = _requestPlatformPersonsHandler(id)
  def fireTrackPerson(id: String): Unit            = _trackPersonHandler(id)
  def fireUntrackPerson(): Unit                    = _untrackPersonHandler()
}
