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
          ui ! PeopleInLinePlatforms(lineId, platforms.values.sum)
          ui ! PeopleInLineStations(lineId, stations.values.sum)
          Behaviors.same

        case PeopleInPlatform(platformId, people) =>
          if (people > 100) ui ! PlatformOvercrowded(platformId, people)
          platforms(platformId) = people
          platformId.split("_").last.toIntOption.foreach { anden =>
            ui ! PeopleInSpecificPlatform(anden, people)
          }
          Behaviors.same

        case PeopleInStation(stationId, people) =>
          if (people > 1000) ui ! StationOvercrowded(stationId, people)
          stations(stationId) = people
          ui ! PeopleInSpecificStation(stationId, people)
          Behaviors.same
      }
    }
}
