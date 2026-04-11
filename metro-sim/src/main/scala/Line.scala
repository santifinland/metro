// Metro. SDMT

import scala.concurrent.duration.DurationInt

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Line {

  def apply(ui: ActorRef[UIMessage], lineId: String): Behavior[LineMessage] =
    Behaviors.withTimers { timers =>
      timers.startTimerWithFixedDelay("line-tick", LineTick, 3.seconds, 3.seconds)

      val platforms: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map.empty
      val stations: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map.empty

      Behaviors.receiveMessage {

        case LineTick =>
          val platformPeople = platforms.values.sum
          val stationPeople = stations.values.sum
          ui ! PeopleInLinePlatforms(lineId, platformPeople)
          ui ! PeopleInLineStations(lineId, stationPeople)
          Behaviors.same

        case PeopleInPlatform(platformId, people) =>
          if (people > 0) {
            scribe.debug(s"There are $people people in platform $platformId")
            if (people > 100) ui ! PlatformOvercrowded(platformId, people)
          }
          platforms(platformId) = people
          Behaviors.same

        case PeopleInStation(stationId, people) =>
          if (people > 0) {
            scribe.debug(s"There are $people people in station $stationId")
            if (people > 1000) ui ! StationOvercrowded(stationId, people)
          }
          stations(stationId) = people
          Behaviors.same
      }
    }
}
