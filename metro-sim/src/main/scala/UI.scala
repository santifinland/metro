// Metro. SDMT

import scala.concurrent.duration.DurationInt

import org.apache.pekko.actor.typed.Behavior
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._
import utils.WebSocket


object UI {

  def apply(): Behavior[UIMessage] =
    Behaviors.withTimers { timers =>
      timers.startTimerWithFixedDelay("trains-tick", UITrainsTick, 3.seconds, 1.second)

      val trains: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map.empty

      Behaviors.receiveMessage {

        case UITrainsTick =>
          val people = trains.values.sum
          WebSocket.sendStat("peopleInTrains",
            s"""{"message": "peopleInTrains", "people": $people}""")
          Behaviors.same

        case PeopleInTrain(trainId, people) =>
          scribe.debug(s"There are $people people in train $trainId")
          trains(trainId) = people
          Behaviors.same

        case PeopleInLinePlatforms(lineId, people) =>
          scribe.debug(s"There are $people people in line $lineId platforms")
          WebSocket.sendStat(s"peopleInLinePlatforms:$lineId",
            s"""{"message": "peopleInLinePlatforms", "line": "$lineId", "people": $people}""")
          Behaviors.same

        case PeopleInLineStations(lineId, people) =>
          scribe.debug(s"There are $people people in line $lineId stations")
          WebSocket.sendStat(s"peopleInLineStations:$lineId",
            s"""{"message": "peopleInLineStations", "line": "$lineId", "people": $people}""")
          Behaviors.same

        case PlatformOvercrowded(platformId, people) =>
          scribe.debug(s"There are $people people in platform $platformId")
          WebSocket.sendText(
            s"""{"message": "platformOvercrowded", "platform": "$platformId", "people": $people}""")
          Behaviors.same

        case StationOvercrowded(stationId, people) =>
          scribe.debug(s"There are $people people in station $stationId")
          WebSocket.sendText(
            s"""{"message": "stationOvercrowded", "station": "$stationId", "people": $people}""")
          Behaviors.same

        case PeopleInMetro(people) =>
          scribe.debug(s"There are $people people in Metro")
          WebSocket.sendStat("peopleInMetro",
            s"""{"message": "peopleInMetro", "people": $people}""")
          Behaviors.same

        case PeopleInSimulation(people) =>
          scribe.debug(s"Simulation handled $people people")
          WebSocket.sendStat("peopleInSimulation",
            s"""{"message": "peopleInSimulation", "people": $people}""")
          Behaviors.same
      }
    }
}
