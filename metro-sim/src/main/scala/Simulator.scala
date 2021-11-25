// Metro. SDMT

import scala.collection.immutable.SortedMap
import scala.util.Random

import akka.actor.{ActorRef, ActorSystem, Props}
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.Distribution


class Simulator(actorSystem: ActorSystem, actors: List[ActorRef], metroGraph: Graph[MetroNode, WDiEdge]) {

  val random = new Random

  def simulate(timeMultiplier: Double, limit: Option[Int] = None): Unit = {
    val daily_journeys = 50000
    //val people: Int = (HourDistribution.value(0.4) * daily_journeys * 0.2 / (2 * 24 * 360)).toInt
    val people: Int = 1
    // In each station people is created
    val stations: List[metroGraph.NodeT] = metroGraph
      .nodes
      .filter(x => x.value.name.startsWith(Metro.StationPrefix))
      .toList
    for {
      startNode <- if (limit.isDefined) stations.take(limit.get) else stations
      destinationNode = stations(random.nextInt(stations.size))
      journey: Option[metroGraph.Path] = startNode shortestPathTo destinationNode
      path = journey
        .get
        .nodes
        .map(x => actors.filter(y => y.path.name == x.name).head)
        .toSeq
      _ = scribe.debug(s"""Person going to $journey""")
      uuid = java.util.UUID.randomUUID.toString
      person = actorSystem.actorOf(Props(classOf[Person], path, timeMultiplier), uuid)
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
