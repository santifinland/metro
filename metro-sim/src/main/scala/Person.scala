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

      var trackingUi: Option[ActorRef[UIMessage]] = None
      val pathIndexMap: Map[String, Int] = path.zipWithIndex.map { case (ref, idx) => ref.path.name -> idx }.toMap

      val destination: String = path.last.path.name.stripPrefix(Metro.StationPrefix)

      def report(locType: String, locId: String): Unit =
        trackingUi.foreach(_ ! PersonTrackerUpdate(personName, locType, locId))

      def platformCode(ref: ActorRef[_]): String = ref.path.name.stripPrefix(Metro.PlatformPrefix)
      def stationId(ref: ActorRef[_]): String    = ref.path.name

      def isStation(ref: ActorRef[_]): Boolean = ref.path.name.startsWith(Metro.StationPrefix)

      def stationRef(ref: ActorRef[_]): ActorRef[StationMessage] =
        ref.asInstanceOf[ActorRef[StationMessage]]
      def platformRef(ref: ActorRef[_]): ActorRef[PlatformMessage] =
        ref.asInstanceOf[ActorRef[PlatformMessage]]

      def nextNodeIndex(currentRef: ActorRef[_]): Int =
        pathIndexMap.getOrElse(currentRef.path.name, -2) + 1

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
              else platformRef(next) ! RequestEnterPlatform(selfRef, destination)
              inStation(station)
            }

          case NotAcceptedEnterStation =>
            SimClock.scheduleIn(RetryMs) { () => stationRef(path.head) ! RequestEnterStation(selfRef) }
            Behaviors.same

          case TrackMe(ui) =>
            trackingUi = Some(ui)
            ui ! PersonPlanPath(personName, path.map(_.path.name).toList)
            Behaviors.same

          case UntrackMe =>
            trackingUi = None
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
              else platformRef(next) ! RequestEnterPlatform(selfRef, destination)
              inStation(newStation)
            }

          case AcceptedEnterPlatform(platform) =>
            currentStation ! ExitStation(personName)
            report("platform", platformCode(platform))
            scribe.debug(s"Person $personName entered platform ${platform.path.name}")
            inPlatform(platform, path(nextNodeIndex(platform)))

          case NotAcceptedEnterPlatform =>
            SimClock.scheduleIn(RetryMs) { () =>
              val idx = nextNodeIndex(currentStation)
              if (idx < path.size) platformRef(path(idx)) ! RequestEnterPlatform(selfRef, destination)
            }
            Behaviors.same

          case TrackMe(ui) =>
            trackingUi = Some(ui)
            ui ! PersonPlanPath(personName, path.map(_.path.name).toList)
            report("station", stationId(currentStation))
            Behaviors.same

          case UntrackMe =>
            trackingUi = None
            Behaviors.same

          case _ => Behaviors.same
        }

      def inPlatform(currentPlatform: ActorRef[PlatformMessage], nextNode: ActorRef[_]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case TrainInPlatform(train) =>
            scribe.debug(s"Train ${train.path.name} available at ${currentPlatform.path.name}")
            train ! RequestEnterTrain(selfRef, destination)
            Behaviors.same

          case AcceptedEnterTrain(platform, train) =>
            scribe.debug(s"Person $personName inside train at ${platform.path.name}")
            platform ! ExitPlatform(personName)
            report("train", train.path.name)
            inTrain(currentPlatform, train)

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
              else platformRef(next) ! RequestEnterPlatform(selfRef, destination)
              inStation(station)
            }

          case TrackMe(ui) =>
            trackingUi = Some(ui)
            ui ! PersonPlanPath(personName, path.map(_.path.name).toList)
            report("platform", platformCode(currentPlatform))
            Behaviors.same

          case UntrackMe =>
            trackingUi = None
            Behaviors.same

          case _ => Behaviors.same
        }

      def inTrain(lastPlatform: ActorRef[PlatformMessage], train: ActorRef[TrainMessage]): Behavior[PersonMessage] =
        Behaviors.receiveMessage {

          case ArrivedAtPlatformToPeople(platform) =>
            val platformIdx = pathIndexMap.getOrElse(platform.path.name, -1)
            if (platformIdx < 0) {
              Behaviors.same  // not our stop
            } else {
              val idx = platformIdx + 1
              if (idx < path.size && isStation(path(idx))) {
                scribe.debug(s"Person $personName disembarking at ${platform.path.name}")
                train ! ExitTrain(personName)
                platform ! EnteredPlatformFromTrain(selfRef, destination)
                report("platform", platformCode(platform))
                stationRef(path(idx)) ! RequestEnterStation(selfRef)
                inPlatform(platform, path(idx))
              } else {
                Behaviors.same
              }
            }

          case TrackMe(ui) =>
            trackingUi = Some(ui)
            ui ! PersonPlanPath(personName, path.map(_.path.name).toList)
            report("train", train.path.name)
            Behaviors.same

          case UntrackMe =>
            trackingUi = None
            Behaviors.same

          case _ => Behaviors.same
        }

      initial()
    }
}
