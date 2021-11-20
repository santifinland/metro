// Metro. SDMT

import scala.collection.immutable.SortedMap
import scala.util.Random

import Metro.PlatformPrefix
import akka.actor.{ActorRef, ActorSystem, Props}
import messages.Messages.EnterStation
import parser.Path
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.Distribution


class Simulator(actorSystem: ActorSystem, stationActors: Map[String, Seq[ActorRef]],
                sortedLines: Map[String, Seq[Path]], metroGraph: Graph[String, WDiEdge]) {

  val random = new Random
  val allPaths: List[Path] = sortedLines.values.flatten.toList
  val allStations: List[ActorRef] = stationActors.values.flatten.toList

  def simulate(timeMultiplier: Double): Unit = {
    val daily_journeys = 50000
    //val people: Int = (HourDistribution.value(0.4) * daily_journeys * 0.2 / (2 * 24 * 360)).toInt
    val people: Int = 1
    // In each platform of each station, new people is created
    stationActors.foreach { case (line, actors) => actors.foreach { x =>
      val start = x  // This persons starts the journey here, in current station of this loop of the foreach
      val actorsLength: Int = actors.size
      Range(0, people).foreach { _ =>
        val destination: ActorRef = allStations(random.nextInt(allStations.size))  // TODO: apply probability dist over destinations
        val startNodeNme = PlatformPrefix + start.path.name
        val startNode = metroGraph.nodes.get(PlatformPrefix + start.path.name)
        val destinationNodeName = PlatformPrefix + destination.path.name
        val destinationNode = metroGraph.nodes.get(PlatformPrefix + destination.path.name)
        scribe.debug(s"Person wants to go from $startNodeNme to $destinationNodeName")
        val journey: Option[metroGraph.Path] = startNode shortestPathTo destinationNode
        scribe.debug(s"Simulated journey: $journey")
        //scribe.info(s"""Person going to : ${destination.path.name}. Shortest: $shortes""")
        val uuid = java.util.UUID.randomUUID.toString
        // TODO: Person class now needs a jurney instead of single destination
        val person = actorSystem.actorOf(Props(classOf[Person], destination, timeMultiplier), uuid)
        person ! EnterStation(start)
      }
    }
    }
  }
}

object Simulator {

  val HourDistribution = new Distribution(SortedMap[Double, Int](
    0.208 -> 1,
    0.25 -> 2,
    0.291 -> 6,
    0.333 -> 11,
    0.375 -> 7,
    0.416 -> 5,
    0.458 -> 6,
    0.5 -> 6,
    0.541 -> 6,
    0.583 -> 8,
    0.625 -> 6,
    0.625 -> 7,
    0.666 -> 8,
    0.708 -> 8,
    0.750 -> 7,
    0.791 -> 5,
    0.833 -> 3,
    0.875 -> 2,
    0.916 -> 1,
    0.958 -> 1,
    1.0 -> 1,
  ))
}
