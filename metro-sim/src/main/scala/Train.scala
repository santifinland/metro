// Metro. SDMT

import scala.util.Random

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._
import parser.Path
import utils.WebSocket


object Train {

  private val MAX_CAPACITY = 1000

  // Delays in simulation milliseconds (no timeMultiplier — SimClock handles speed)
  private val FallbackTravelMs = 122_000L  // network average from MITMA data
  private val MinDoorsMs  = 20_000L
  private val MaxDoorsMs  = 40_000L
  private val FullRetryMs = 30_000L

  def apply(ui: ActorRef[UIMessage], pathByName: Map[String, Path]): Behavior[TrainMessage] =
    Behaviors.setup { context =>
      val rng = new Random

      def travelMsForPath(p: Option[Path]): Long = p match {
        case Some(pp) if pp.features.velocidadtramoanterior > 0 && pp.features.longitudtramoanterior > 0 =>
          (pp.features.longitudtramoanterior / pp.features.velocidadtramoanterior * 3600).toLong
        case _ => FallbackTravelMs
      }
      def doorsMs():  Long = MinDoorsMs  + rng.nextLong(MaxDoorsMs  - MinDoorsMs)

      Behaviors.withTimers { timers =>
        // Stats tick stays on real-time (only feeds WebSocket reporting)
        import scala.concurrent.duration.DurationInt
        timers.startTimerWithFixedDelay("stats-tick", TrainStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], String)] =
          scala.collection.mutable.Map.empty

        var platform: Option[ActorRef[PlatformMessage]] = None
        var nextPlatform: Option[ActorRef[PlatformMessage]] = None
        var retiring = false
        var x: Double = 0
        var y: Double = 0
        var lastTravelSimMs: Long = FallbackTravelMs
        val trainName = context.self.path.name
        val selfRef   = context.self

        def findPlatformPath(p: ActorRef[PlatformMessage]): Option[Path] =
          pathByName.get(p.path.name)

        TrainRegistry.register(trainName, selfRef)

        Behaviors.receiveMessage {

          case TrainStatsTick =>
            ui ! PeopleInTrain(trainName, people.size)
            Behaviors.same

          case RequestPersonList =>
            ui ! PersonsInTrain(trainName, people.map { case (id, (_, dest)) => (id, dest) }.toList)
            Behaviors.same

          case Move(p) =>
            p ! ReservePlatform(selfRef)
            Behaviors.same

          case PlatformReserved(p) =>
            if (platform.isEmpty) {
              platform = Some(p)
              val pp = findPlatformPath(p)
              pp.foreach { path => x = path.x; y = path.y }
              val anden = pp.map(_.features.codigoanden).getOrElse(0)
              WebSocket.sendTrain(trainName, x, y, people.size, MAX_CAPACITY, anden, travelMs = 0L, isNew = true)
              SimClock.scheduleIn(travelMsForPath(pp)) { () =>
                platform.foreach(_ ! GetNextPlatform(selfRef))
              }
            } else {
              nextPlatform = Some(p)
              val nextPp = findPlatformPath(p)
              lastTravelSimMs = travelMsForPath(nextPp)
              SimClock.scheduleIn(lastTravelSimMs) { () => selfRef ! TrainArrivedAtPlatform }
            }
            Behaviors.same

          case TrainArrivedAtPlatform =>
            val prevPlatform = platform
            platform = nextPlatform
            prevPlatform.get ! LeavingPlatform
            platform.get ! ArrivedAtPlatform(selfRef)
            people.foreach { case (_, (person, _)) => person ! ArrivedAtPlatformToPeople(platform.get) }
            val pp = findPlatformPath(platform.get)
            pp.foreach { path => x = path.x; y = path.y }
            val anden = pp.map(_.features.codigoanden).getOrElse(0)
            val wallClockMs = (lastTravelSimMs.toDouble / SimClock.speedFactor).toLong
            WebSocket.sendTrain(trainName, x, y, people.size, MAX_CAPACITY, anden, wallClockMs, isNew = false)
            nextPlatform = None
            if (retiring) {
              scribe.info(s"Train $trainName retiring after arrival at platform")
              TrainRegistry.unregister(trainName)
              SimClock.scheduleIn(doorsMs()) { () =>
                platform.foreach(_ ! LeavingPlatform)
                WebSocket.removeTrain(trainName)
              }
              Behaviors.stopped
            } else {
              SimClock.scheduleIn(doorsMs()) { () =>
                platform.foreach(_ ! GetNextPlatform(selfRef))
              }
              Behaviors.same
            }

          case NextPlatformForTrain(p) =>
            nextPlatform = Some(p)
            p ! ReservePlatform(selfRef)
            Behaviors.same

          case FullPlatform(p) =>
            SimClock.scheduleIn(FullRetryMs) { () => p ! ReservePlatform(selfRef) }
            Behaviors.same

          case RequestEnterTrain(person, destination) =>
            if (retiring) {
              person ! NotAcceptedEnterTrain
            } else if (people.size < MAX_CAPACITY) {
              people(person.path.name) = (person, destination)
              person ! AcceptedEnterTrain(platform.get, selfRef)
            } else {
              scribe.warn(s"Train $trainName over capacity at ${platform.get.path.name}")
              person ! NotAcceptedEnterTrain
            }
            Behaviors.same

          case ExitTrain(personId) =>
            people.remove(personId)
            Behaviors.same

          case RetireTrain =>
            scribe.info(s"Train $trainName marked for retirement")
            retiring = true
            Behaviors.same

          case ResetTrain(startPlatform) =>
            scribe.debug(s"Train $trainName resetting")
            people.clear()
            platform     = None
            nextPlatform = None
            retiring     = false
            x = 0; y = 0
            startPlatform ! ReservePlatform(selfRef)
            Behaviors.same
        }
      }
    }
}
