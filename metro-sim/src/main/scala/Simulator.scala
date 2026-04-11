// Metro. SDMT

import scala.concurrent.duration.{DurationDouble, DurationInt}
import scala.util.Random

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._
import parser.{Entrance, StationIds}
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge


object Simulator {

  val HourDistribution: Map[Int, Double] = Map(
    6 -> 1, 7 -> 2, 8 -> 6, 9 -> 11, 10 -> 7,
    11 -> 5, 12 -> 6, 13 -> 6, 14 -> 6, 15 -> 8,
    16 -> 6, 17 -> 7, 18 -> 8, 19 -> 8, 20 -> 7,
    21 -> 5, 22 -> 3, 23 -> 2
  )

  private val TimeStep = 10

  def apply(
    ui: ActorRef[UIMessage],
    stationActors: List[ActorRef[_]],
    metroGraph: Graph[MetroNode, WDiEdge],
    stationIdsEntrance: Map[StationIds, Option[Entrance]],
    timeMultiplier: Double
  ): Behavior[SimulatorMessage] =
    Behaviors.setup { context =>
      Behaviors.withTimers { timers =>
        timers.startTimerWithFixedDelay("simulate-tick", SimulateStep,
          1.second, (TimeStep * timeMultiplier).seconds)
        timers.startTimerWithFixedDelay("stats-tick", SimulatorStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty
        var simulationPeople: Int = 0
        var time: Long = 6 * 3600 * 1000

        val random = new Random

        val stations: List[metroGraph.NodeT] = metroGraph
          .nodes
          .filter(x => x.value.name.startsWith(Metro.StationPrefix))
          .toList

        Behaviors.receiveMessage {

          case SimulatorStatsTick =>
            ui ! PeopleInMetro(people.size)
            ui ! PeopleInSimulation(simulationPeople)
            Behaviors.same

          case SimulateStep =>
            time += TimeStep * 1000
            scribe.info(s"Simulator issuing Persons, time multiplier $timeMultiplier")
            for {
              startNode <- stations
              startStationId <- stationIdsEntrance
                .filter { case (k, _) => startNode.value.name.contains(k.name) }
                .values.flatten
              dailyEntrance: Double = startStationId.entrance / 30.0
              hourKey = (24 * (time.toDouble / (86400.0 * 1000))).toInt
              hourMultiplier: Double = HourDistribution.getOrElse(hourKey, 0.0)
              peopleCount: Double = (dailyEntrance / (86400.0 * timeMultiplier) +
                startNode.partialPerson) * hourMultiplier
              integerPart: Int = peopleCount.toInt
              floatPart: Double = peopleCount - integerPart
              _ = if (floatPart > 0) startNode.setPartialPerson(floatPart)
              _ <- 1 to integerPart
              otherStations = stations.filter(x => !x.value.name.equals(startNode.value.name))
              destinationNode = otherStations(random.nextInt(otherStations.size))
              journey: Option[metroGraph.Path] = startNode shortestPathTo destinationNode
              path = journey.get.nodes
                .map(x => stationActors.filter(y => y.path.name == x.name).head)
                .toSeq
              uuid = java.util.UUID.randomUUID.toString
              person = context.spawn(Person(context.self, path, timeMultiplier), uuid)
              _ = people(person.path.name) = person
              _ = simulationPeople += 1
            } yield ()
            Behaviors.same

          case ArrivedToDestination(person) =>
            scribe.debug(s"Person ${person.path.name} arrived to destination")
            people.remove(person.path.name)
            Behaviors.same
        }
      }
    }
}
