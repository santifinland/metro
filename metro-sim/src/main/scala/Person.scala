// Metro. SDMT

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Person {

  // Retry delays in simulation milliseconds
  private val RetryMs = 5_000L

  def apply(
    simulator: ActorRef[SimulatorMessage],
    path: Seq[ActorRef[_]]
  ): Behavior[PersonMessage] =
    Behaviors.setup { context =>
      val personName = context.self.path.name
      val selfRef    = context.self

      def isStation(ref: ActorRef[_]): Boolean = ref.path.name.startsWith(Metro.StationPrefix)

      def stationRef(ref: ActorRef[_]): ActorRef[StationMessage] =
        ref.asInstanceOf[ActorRef[StationMessage]]
      def platformRef(ref: ActorRef[_]): ActorRef[PlatformMessage] =
        ref.asInstanceOf[ActorRef[PlatformMessage]]

      def nextNodeIndex(currentRef: ActorRef[_]): Int =
        path.indexWhere(_.path.name == currentRef.path.name) + 1

      // Start: request entry into first node (always a station)
      scribe.debug(s"Person $personName to ${path.last.path.name} wants to enter ${path.head.path.name}")
      stationRef(path.head) ! RequestEnterStation(selfRef)

      def initial(): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case AcceptedEnterStation(station) =>
            val idx = nextNodeIndex(station)
            if (idx >= path.size) {
              scribe.debug(s"Person $personName arrived final destination")
              station ! ExitStation(personName)
              simulator ! ArrivedToDestination(selfRef)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(selfRef)
              else platformRef(next) ! RequestEnterPlatform(selfRef)
              inStation(station)
            }

          case NotAcceptedEnterStation =>
            SimClock.scheduleIn(RetryMs) { () => stationRef(path.head) ! RequestEnterStation(selfRef) }
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
              simulator ! ArrivedToDestination(selfRef)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(selfRef)
              else platformRef(next) ! RequestEnterPlatform(selfRef)
              inStation(newStation)
            }

          case AcceptedEnterPlatform(platform) =>
            currentStation ! ExitStation(personName)
            scribe.debug(s"Person $personName entered platform ${platform.path.name}")
            inPlatform(platform, path(nextNodeIndex(platform)))

          case NotAcceptedEnterPlatform =>
            SimClock.scheduleIn(RetryMs) { () =>
              val idx = nextNodeIndex(currentStation)
              if (idx < path.size) platformRef(path(idx)) ! RequestEnterPlatform(selfRef)
            }
            Behaviors.same

          case _ => Behaviors.same
        }

      def inPlatform(currentPlatform: ActorRef[PlatformMessage], nextNode: ActorRef[_]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case TrainInPlatform(train) =>
            scribe.debug(s"Train ${train.path.name} available at ${currentPlatform.path.name}")
            train ! RequestEnterTrain(selfRef)
            Behaviors.same

          case AcceptedEnterTrain(platform) =>
            scribe.debug(s"Person $personName inside train at ${platform.path.name}")
            platform ! ExitPlatform(personName)
            inTrain(currentPlatform)

          case NotAcceptedEnterTrain =>
            scribe.debug(s"Person $personName not accepted in train")
            Behaviors.same

          case AcceptedEnterStation(station) =>
            currentPlatform ! ExitPlatform(personName)
            val idx = nextNodeIndex(station)
            if (idx >= path.size) {
              station ! ExitStation(personName)
              simulator ! ArrivedToDestination(selfRef)
              Behaviors.stopped
            } else {
              val next = path(idx)
              if (isStation(next)) stationRef(next) ! RequestEnterStation(selfRef)
              else platformRef(next) ! RequestEnterPlatform(selfRef)
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
              scribe.debug(s"Person $personName disembarking at ${platform.path.name}")
              platform ! EnteredPlatformFromTrain(selfRef)
              stationRef(path(idx)) ! RequestEnterStation(selfRef)
              inPlatform(platform, path(idx))
            } else {
              Behaviors.same
            }

          case _ => Behaviors.same
        }

      initial()
    }
}
