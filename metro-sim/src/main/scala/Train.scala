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
  private val MinTravelMs = 90_000L
  private val MaxTravelMs = 180_000L
  private val MinDoorsMs  = 20_000L
  private val MaxDoorsMs  = 40_000L
  private val FullRetryMs = 30_000L

  def apply(ui: ActorRef[UIMessage], allPaths: Seq[Path]): Behavior[TrainMessage] =
    Behaviors.setup { context =>
      val rng = new Random

      def travelMs(): Long = MinTravelMs + rng.nextLong(MaxTravelMs - MinTravelMs)
      def doorsMs():  Long = MinDoorsMs  + rng.nextLong(MaxDoorsMs  - MinDoorsMs)

      Behaviors.withTimers { timers =>
        // Stats tick stays on real-time (only feeds WebSocket reporting)
        import scala.concurrent.duration.DurationInt
        timers.startTimerWithFixedDelay("stats-tick", TrainStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty

        var platform: Option[ActorRef[PlatformMessage]] = None
        var nextPlatform: Option[ActorRef[PlatformMessage]] = None
        var x: Double = 0
        var y: Double = 0
        val trainName = context.self.path.name
        val selfRef   = context.self

        def findPlatformPath(p: ActorRef[PlatformMessage]): Option[Path] =
          allPaths.find(pp =>
            Metro.platformName(pp.features.denominacion, pp.features.codigoanden) == p.path.name)

        Behaviors.receiveMessage {

          case TrainStatsTick =>
            ui ! PeopleInTrain(trainName, people.size)
            Behaviors.same

          case Move(p) =>
            scribe.debug(s"Train $trainName wants to move from ${p.path.name}")
            p ! ReservePlatform(selfRef)
            Behaviors.same

          case PlatformReserved(p) =>
            if (platform.isEmpty) {
              platform = Some(p)
              scribe.debug(s"Train $trainName starting at ${p.path.name}")
              findPlatformPath(p).foreach { pp =>
                x = pp.x; y = pp.y
                WebSocket.sendTrain(trainName, x, y, people.size, MAX_CAPACITY, isNew = true)
              }
              SimClock.scheduleIn(travelMs()) { () =>
                platform.foreach(_ ! GetNextPlatform(selfRef))
              }
            } else {
              scribe.debug(s"Train $trainName departing from ${platform.get.path.name}")
              nextPlatform = Some(p)
              platform.get ! LeavingPlatform
              SimClock.scheduleIn(travelMs()) { () => selfRef ! TrainArrivedAtPlatform }
            }
            Behaviors.same

          case TrainArrivedAtPlatform =>
            scribe.debug(s"Train $trainName arriving at ${nextPlatform.get.path.name}")
            platform = nextPlatform
            platform.get ! ArrivedAtPlatform(selfRef)
            people.foreach { case (_, person) => person ! ArrivedAtPlatformToPeople(platform.get) }
            findPlatformPath(platform.get).foreach { pp => x = pp.x; y = pp.y }
            WebSocket.sendTrain(trainName, x, y, people.size, MAX_CAPACITY, isNew = false)
            nextPlatform = None
            SimClock.scheduleIn(doorsMs()) { () =>
              platform.foreach(_ ! GetNextPlatform(selfRef))
            }
            Behaviors.same

          case NextPlatformForTrain(p) =>
            nextPlatform = Some(p)
            scribe.debug(s"Train $trainName knows next platform ${p.path.name}")
            p ! ReservePlatform(selfRef)
            Behaviors.same

          case FullPlatform(p) =>
            scribe.debug(s"Train $trainName waiting — platform ${p.path.name} full")
            SimClock.scheduleIn(FullRetryMs) { () => p ! ReservePlatform(selfRef) }
            Behaviors.same

          case RequestEnterTrain(person) =>
            if (people.size < MAX_CAPACITY) {
              people(person.path.name) = person
              person ! AcceptedEnterTrain(platform.get)
            } else {
              scribe.warn(s"Train $trainName over capacity at ${platform.get.path.name}")
              person ! NotAcceptedEnterTrain
            }
            Behaviors.same

          case ExitTrain(personId) =>
            scribe.debug(s"Person $personId exits train $trainName")
            people.remove(personId)
            Behaviors.same

          case ResetTrain(startPlatform) =>
            scribe.debug(s"Train $trainName resetting")
            people.clear()
            platform     = None
            nextPlatform = None
            x = 0; y = 0
            startPlatform ! ReservePlatform(selfRef)
            Behaviors.same
        }
      }
    }
}
