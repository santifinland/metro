// Metro. SDMT

import scala.concurrent.duration.{DurationInt, FiniteDuration, SECONDS}
import scala.util.Random

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._
import parser.Path
import utils.WebSocket


object Train {

  private val MAX_CAPACITY = 1000

  def apply(ui: ActorRef[UIMessage], allPaths: Seq[Path], timeMultiplier: Double): Behavior[TrainMessage] =
    Behaviors.setup { context =>
      val timeBetweenPlatforms: FiniteDuration =
        FiniteDuration((Random.between(90, 180) * timeMultiplier).toLong, SECONDS)
      val timeOpenDoors: FiniteDuration =
        FiniteDuration((Random.between(20, 40) * timeMultiplier).toLong, SECONDS)

      Behaviors.withTimers { timers =>
        timers.startTimerWithFixedDelay("stats-tick", TrainStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty

        var platform: Option[ActorRef[PlatformMessage]] = None
        var nextPlatform: Option[ActorRef[PlatformMessage]] = None
        var x: Double = 0
        var y: Double = 0
        val trainName = context.self.path.name

        def findPlatformPath(p: ActorRef[PlatformMessage]): Option[Path] =
          allPaths.find(pp =>
            Metro.platformName(pp.features.denominacion, pp.features.codigoanden) == p.path.name)

        def sendMovement(): Unit =
          WebSocket.sendText(
            s"""{"message": "moveTrain", "train": "$trainName", "x": $x, "y": $y}""")

        Behaviors.receiveMessage {

          case TrainStatsTick =>
            ui ! PeopleInTrain(trainName, people.size)
            Behaviors.same

          case Move(p) =>
            scribe.debug(s"Train $trainName wants to move from ${p.path.name}")
            p ! ReservePlatform(context.self)
            Behaviors.same

          case PlatformReserved(p) =>
            if (platform.isEmpty) {
              platform = Some(p)
              scribe.debug(s"Train $trainName starting at ${p.path.name}")
              findPlatformPath(p).foreach { pp =>
                x = pp.x; y = pp.y
                WebSocket.sendText(
                  s"""{"message": "newTrain", "train": "$trainName", "x": $x, "y": $y}""")
              }
              context.system.scheduler.scheduleOnce(timeBetweenPlatforms, () =>
                platform.get ! GetNextPlatform(context.self))(context.executionContext)
            } else {
              scribe.debug(s"Train $trainName departing from ${platform.get.path.name}")
              nextPlatform = Some(p)
              platform.get ! LeavingPlatform
              context.system.scheduler.scheduleOnce(timeBetweenPlatforms, () =>
                context.self ! TrainArrivedAtPlatform)(context.executionContext)
            }
            Behaviors.same

          case TrainArrivedAtPlatform =>
            scribe.debug(s"Train $trainName arriving at ${nextPlatform.get.path.name}")
            platform = nextPlatform
            platform.get ! ArrivedAtPlatform(context.self)
            people.foreach { case (_, person) => person ! ArrivedAtPlatformToPeople(platform.get) }
            findPlatformPath(platform.get).foreach { pp => x = pp.x; y = pp.y }
            sendMovement()
            nextPlatform = None
            context.system.scheduler.scheduleOnce(timeOpenDoors, () =>
              platform.get ! GetNextPlatform(context.self))(context.executionContext)
            Behaviors.same

          case NextPlatformForTrain(p) =>
            nextPlatform = Some(p)
            scribe.debug(s"Train $trainName knows next platform ${p.path.name}")
            p ! ReservePlatform(context.self)
            Behaviors.same

          case FullPlatform(p) =>
            scribe.debug(s"Train $trainName waiting — platform ${p.path.name} full")
            context.system.scheduler.scheduleOnce(5.seconds, () =>
              p ! ReservePlatform(context.self))(context.executionContext)
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
        }
      }
    }
}
