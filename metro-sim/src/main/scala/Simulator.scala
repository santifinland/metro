// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.util.Random

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._
import parser.{DistrictData, Entrance, ODMatrix, StationIds}
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge


object Simulator {

  val HourDistribution: Map[Int, Double] = Map(
    6 -> 1, 7 -> 2, 8 -> 6, 9 -> 11, 10 -> 7,
    11 -> 5, 12 -> 6, 13 -> 6, 14 -> 6, 15 -> 8,
    16 -> 6, 17 -> 7, 18 -> 8, 19 -> 8, 20 -> 7,
    21 -> 5, 22 -> 3, 23 -> 2
  )
  private val HourDistributionSum: Double = HourDistribution.values.sum

  private val TimeStepMs = 10_000L

  def apply(
    ui: ActorRef[UIMessage],
    actorsByName: Map[String, ActorRef[_]],
    metroGraph: Graph[MetroNode, WDiEdge],
    stationIdsEntrance: Map[StationIds, Option[Entrance]],
    odMatrix: ODMatrix,
    districtData: DistrictData,
  ): Behavior[SimulatorMessage] =
    Behaviors.setup { context =>
      Behaviors.withTimers { timers =>
        timers.startTimerWithFixedDelay("stats-tick", SimulatorStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty
        val pathCache: scala.collection.mutable.Map[(String, String), Seq[ActorRef[_]]] =
          scala.collection.mutable.Map.empty
        var simulationPeople: Int = 0
        var trackedPerson: Option[ActorRef[PersonMessage]] = None
        val selfRef = context.self
        val random  = new Random

        val stations: List[metroGraph.NodeT] = metroGraph
          .nodes
          .filter(_.value.name.startsWith(Metro.StationPrefix))
          .toList

        val empresaToNode: Map[String, metroGraph.NodeT] = stations.map { node =>
          node.value.name.stripPrefix(Metro.StationPrefix) -> node
        }.toMap

        // Weighted random sample from normalised weight map
        def weightedSample(weights: Map[String, Double]): String = {
          val roll = random.nextDouble()
          var cum  = 0.0
          for ((k, w) <- weights) {
            cum += w
            if (cum >= roll) return k
          }
          weights.keys.last
        }

        // OD-based destination selection; falls back to uniform random when data is missing
        def pickDestination(startNode: metroGraph.NodeT, hour: Int): metroGraph.NodeT = {
          val startEmpresa = startNode.value.name.stripPrefix(Metro.StationPrefix)

          val odResult: Option[metroGraph.NodeT] = for {
            origDistrict <- districtData.empresaToDistrict.get(startEmpresa)
            hourMap      <- odMatrix.od.get(hour)
            destMap      <- hourMap.get(origDistrict)
            if destMap.nonEmpty
            destDistrict  = weightedSample(destMap)
            destEmpresas <- districtData.districtToStations.get(destDistrict)
            if destEmpresas.nonEmpty
            empresa       = destEmpresas(random.nextInt(destEmpresas.size))
            node         <- empresaToNode.get(empresa)
            if node.value.name != startNode.value.name
          } yield node

          odResult.getOrElse {
            val others = stations.filter(_.value.name != startNode.value.name)
            others(random.nextInt(others.size))
          }
        }

        SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }

        Behaviors.receiveMessage {

          case SimulatorStatsTick =>
            ui ! PeopleInMetro(people.size)
            ui ! PeopleInSimulation(simulationPeople)
            Behaviors.same

          case SimulateStep =>
            val simTimeMs = SimClock.simTimeMs
            scribe.info(s"Simulator step at sim-time ${simTimeMs / 1000}s (${people.size} active people)")

            val hourKey = ((simTimeMs.toDouble / 3_600_000.0) % 24).toInt

            for {
              startNode <- stations
              nodeCode = startNode.value.name.stripPrefix(Metro.StationPrefix)
              startStationId <- stationIdsEntrance
                .filter { case (k, _) => k.id == nodeCode }
                .values.flatten
              dailyEntrance: Double  = startStationId.entrance / 30.0
              hourMultiplier: Double = HourDistribution.getOrElse(hourKey, 0.0)
              baseCount: Double      = dailyEntrance * hourMultiplier / HourDistributionSum * TimeStepMs / 3_600_000.0
              peopleCount: Double    = baseCount + startNode.partialPerson
              integerPart: Int    = peopleCount.toInt
              floatPart:   Double = peopleCount - integerPart
              _ = startNode.setPartialPerson(floatPart)
              _ <- 1 to integerPart
              destinationNode = pickDestination(startNode, hourKey)
              cacheKey = (startNode.value.name, destinationNode.value.name)
              path = pathCache.getOrElseUpdate(cacheKey, {
                val journey = startNode.shortestPathTo(destinationNode, (e: metroGraph.EdgeT) => e.weight)
                journey.get.nodes.map(x => actorsByName(x.name)).toSeq
              })
              uuid   = java.util.UUID.randomUUID.toString
              person = context.spawn(Person(selfRef, path), uuid)
              _ = people(person.path.name) = person
              _ = simulationPeople += 1
            } yield ()

            SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }
            Behaviors.same

          case ArrivedToDestination(person) =>
            scribe.debug(s"Person ${person.path.name} arrived to destination")
            people.remove(person.path.name)
            if (trackedPerson.exists(_.path.name == person.path.name)) {
              ui ! PersonTrackedArrived(person.path.name)
              trackedPerson = None
            }
            Behaviors.same

          case TrackPerson(personId) =>
            trackedPerson.foreach(_ ! UntrackMe)
            people.get(personId) match {
              case Some(person) =>
                person ! TrackMe(ui)
                trackedPerson = Some(person)
              case None =>
                trackedPerson = None
            }
            Behaviors.same

          case UntrackPerson =>
            trackedPerson.foreach(_ ! UntrackMe)
            trackedPerson = None
            Behaviors.same

          case ResetSimulator =>
            scribe.info("Simulator resetting: stopping all persons")
            trackedPerson.foreach(_ ! UntrackMe)
            trackedPerson = None
            people.values.foreach(context.stop)
            people.clear()
            simulationPeople = 0
            SimClock.scheduleIn(TimeStepMs) { () => selfRef ! SimulateStep }
            Behaviors.same
        }
      }
    }
}
