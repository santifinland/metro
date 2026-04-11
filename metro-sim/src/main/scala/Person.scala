// Metro. SDMT

import scala.concurrent.duration.{DurationInt, FiniteDuration, SECONDS}

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Person {

  def apply(
    simulator: ActorRef[SimulatorMessage],
    path: Seq[ActorRef[_]],
    timeMultiplier: Double
  ): Behavior[PersonMessage] =
    Behaviors.setup { context =>
      val waitAtStation: FiniteDuration  = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)
      val waitForStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)
      val waitAtPlatform: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)
      val personName = context.self.path.name

      def isStation(ref: ActorRef[_]): Boolean = ref.path.name.startsWith(Metro.StationPrefix)

      def stationRef(ref: ActorRef[_]): ActorRef[StationMessage] =
        ref.asInstanceOf[ActorRef[StationMessage]]
      def platformRef(ref: ActorRef[_]): ActorRef[PlatformMessage] =
        ref.asInstanceOf[ActorRef[PlatformMessage]]

      def nextNodeIndex(currentRef: ActorRef[_]): Int =
        path.indexWhere(_.path.name == currentRef.path.name) + 1

      // Start: request entry into first node (always a station)
      scribe.debug(s"Person $personName to ${path.last.path.name} wants to enter ${path.head.path.name}")
      stationRef(path.head) ! RequestEnterStation(context.self)

      def initial(): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case AcceptedEnterStation(station) =>
            val idx = nextNodeIndex(station)
            if (idx >= path.size) {
              scribe.debug(s"Person $personName arrived final destination")
              station ! ExitStation(personName)
              simulator ! ArrivedToDestination(context.self)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(context.self)
              else platformRef(next) ! RequestEnterPlatform(context.self)
              inStation(station)
            }

          case NotAcceptedEnterStation =>
            context.system.scheduler.scheduleOnce(waitForStation, () =>
              stationRef(path.head) ! RequestEnterStation(context.self))(context.executionContext)
            Behaviors.same

          case _ => Behaviors.same
        }

      def inStation(currentStation: ActorRef[StationMessage]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case AcceptedEnterStation(newStation) =>
            currentStation ! ExitStation(personName)
            scribe.debug(s"Person $personName moved from ${currentStation.path.name} to ${newStation.path.name}")
            val idx = nextNodeIndex(newStation)
            if (idx >= path.size) {
              scribe.debug(s"Person $personName arrived final destination")
              newStation ! ExitStation(personName)
              simulator ! ArrivedToDestination(context.self)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(context.self)
              else platformRef(next) ! RequestEnterPlatform(context.self)
              inStation(newStation)
            }

          case AcceptedEnterPlatform(platform) =>
            currentStation ! ExitStation(personName)
            scribe.debug(s"Person $personName entered platform ${platform.path.name}")
            inPlatform(platform, path(nextNodeIndex(platform)))

          case NotAcceptedEnterPlatform =>
            context.system.scheduler.scheduleOnce(waitAtStation, () => {
              val idx = nextNodeIndex(currentStation)
              if (idx < path.size) platformRef(path(idx)) ! RequestEnterPlatform(context.self)
            })(context.executionContext)
            Behaviors.same

          case _ => Behaviors.same
        }

      def inPlatform(currentPlatform: ActorRef[PlatformMessage], nextNode: ActorRef[_]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case TrainInPlatform(train) =>
            scribe.debug(s"Train ${train.path.name} available at ${currentPlatform.path.name}")
            train ! RequestEnterTrain(context.self)
            Behaviors.same

          case AcceptedEnterTrain(platform) =>
            scribe.debug(s"Person $personName inside train at ${platform.path.name}")
            platform ! ExitPlatform(personName)
            inTrain(currentPlatform)

          case NotAcceptedEnterTrain =>
            scribe.debug(s"Person $personName not accepted in train")
            // retry — the train will re-check capacity
            Behaviors.same

          case AcceptedEnterStation(station) =>
            currentPlatform ! ExitPlatform(personName)
            val idx = nextNodeIndex(station)
            if (idx >= path.size) {
              station ! ExitStation(personName)
              simulator ! ArrivedToDestination(context.self)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(context.self)
              else platformRef(next) ! RequestEnterPlatform(context.self)
              inStation(station)
            }

          case _ => Behaviors.same
        }

      def inTrain(lastPlatform: ActorRef[PlatformMessage]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case ArrivedAtPlatformToPeople(platform) =>
            scribe.debug(s"Person $personName at platform ${platform.path.name}")
            val idx = nextNodeIndex(platform)
            if (idx < path.size && isStation(path(idx))) {
              // Next stop is a station — disembark
              scribe.debug(s"Person $personName disembarking at ${platform.path.name}")
              platform ! EnteredPlatformFromTrain(context.self)
              stationRef(path(idx)) ! RequestEnterStation(context.self)
              inPlatform(platform, path(idx))
            } else {
              // Stay on train
              Behaviors.same
            }

          case _ => Behaviors.same
        }

      initial()
    }
}
