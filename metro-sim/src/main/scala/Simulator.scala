// Metro. SDMT

import scala.collection.immutable.SortedMap
import scala.util.Random

import akka.actor.{ActorRef, ActorSystem, Props}
import messages.Messages.EnterPlatform
import parser.Path
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.Distribution


class Simulator(actorSystem: ActorSystem, stationActors: List[ActorRef], metroGraph: Graph[MetroNode, WDiEdge]) {

  val random = new Random

  def simulate(timeMultiplier: Double): Unit = {
    val daily_journeys = 50000
    //val people: Int = (HourDistribution.value(0.4) * daily_journeys * 0.2 / (2 * 24 * 360)).toInt
    val people: Int = 1
    // In each station people is created
    val stations: List[metroGraph.NodeT] = metroGraph
      .nodes
      .filter(x => x.value.name.startsWith(Metro.StationPrefix))
      .toList
    for {
      startNode: metroGraph.NodeT <- stations
      destinationNode: metroGraph.NodeT = stations(random.nextInt(stations.size))
      journey = startNode shortestPathTo destinationNode
      _ = scribe.info(s"""Person going to $journey""")
      uuid = java.util.UUID.randomUUID.toString
      start: ActorRef = stationActors.filter(x => x.path.name == startNode.name).head
      destination: ActorRef = stationActors.filter(x => x.path.name == destinationNode.name).head
      person = actorSystem.actorOf(Props(classOf[Person], destination, timeMultiplier), uuid)
      _ = person ! EnterPlatform(start)
    } yield person
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
