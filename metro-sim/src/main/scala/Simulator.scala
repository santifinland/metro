// Metro. SDMT

import scala.concurrent.duration.DurationInt
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

  // Sim-time step between person-spawning ticks (10 sim-seconds)
  private val TimeStepMs = 10_000L

  def apply(
    ui: ActorRef[UIMessage],
    stationActors: List[ActorRef[_]],
    metroGraph: Graph[MetroNode, WDiEdge],
    stationIdsEntrance: Map[StationIds, Option[Entrance]]
  ): Behavior[SimulatorMessage] =
    Behaviors.setup { context =>
      Behaviors.withTimers { timers =>
        // Stats tick: real-time, just for WebSocket reporting
        timers.startTimerWithFixedDelay("stats-tick", SimulatorStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty
        var simulationPeople: Int = 0
        val selfRef = context.self

        val random = new Random

        val stations: List[metroGraph.NodeT] = metroGraph
          .nodes
          .filter(x => x.value.name.startsWith(Metro.StationPrefix))
          .toList

        // Kick off the first SimulateStep via SimClock
        SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }

        Behaviors.receiveMessage {

          case SimulatorStatsTick =>
            ui ! PeopleInMetro(people.size)
            ui ! PeopleInSimulation(simulationPeople)
            Behaviors.same

          case SimulateStep =>
            val simTimeMs = SimClock.simTimeMs
            scribe.info(s"Simulator step at sim-time ${simTimeMs / 1000}s (${people.size} active people)")

            for {
              startNode <- stations
              startStationId <- stationIdsEntrance
                .filter { case (k, _) => startNode.value.name.contains(k.name) }
                .values.flatten
              dailyEntrance: Double = startStationId.entrance / 30.0
              // Hour derived from sim-clock, not wall clock
              hourKey = ((simTimeMs.toDouble / 3_600_000.0) % 24).toInt
              hourMultiplier: Double = HourDistribution.getOrElse(hourKey, 0.0)
              // People to spawn this tick: proportional to sim-time step
              peopleCount: Double = (dailyEntrance * TimeStepMs / 86_400_000.0 +
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
              person = context.spawn(Person(selfRef, path), uuid)
              _ = people(person.path.name) = person
              _ = simulationPeople += 1
            } yield ()

            // Schedule the next tick in simulation time (self-rescheduling)
            SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }
            Behaviors.same

          case ArrivedToDestination(person) =>
            scribe.debug(s"Person ${person.path.name} arrived to destination")
            people.remove(person.path.name)
            Behaviors.same

          case ResetSimulator =>
            scribe.info("Simulator resetting: stopping all persons")
            people.values.foreach(context.stop)
            people.clear()
            simulationPeople = 0
            SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }
            Behaviors.same
        }
      }
    }
}
