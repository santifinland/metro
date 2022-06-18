// Metro. SDMT

import scala.annotation.tailrec
import scala.collection.immutable.SortedMap
import scala.concurrent.duration.{DurationDouble, DurationInt, FiniteDuration}
import scala.util.Random

import Main.actorSystem.{dispatcher, scheduler}
import Simulator.{HourDistribution, getRandomStation}
import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import messages.Messages.{ArrivedToDestination, PeopleInMetro, PeopleInSimulation, Simulate}
import parser.{Entrance, StationIds}
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.Distribution


class Simulator(actorSystem: ActorSystem, ui: ActorRef, stationActors: List[ActorRef], metroGraph: Graph[MetroNode, WDiEdge],
                stationIdsEntrance: Map[StationIds, Option[Entrance]], timeMultiplier: Double) extends Actor {

  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  var simulationPeople: Int = 0

  var time: Long = 6 * 3600 * 1000
  val TimeStep: Int = 10
  val random = new Random

  override def preStart(): Unit = {
    scheduler.scheduleAtFixedRate(1.seconds, (TimeStep * timeMultiplier).seconds)(() => {
      time = time + TimeStep * 1000
      self ! Simulate(None)
    })
    scheduler.scheduleAtFixedRate(3.seconds, 1.seconds)(() => {
      ui ! PeopleInMetro(people.size)
      ui ! PeopleInSimulation(simulationPeople)
    })
  }

  def receive: Receive = {

    case x: Simulate =>
      scribe.info(s"Simulator issuing Persons, with time multiplier $timeMultiplier")
      this.simulateStep(timeMultiplier, x.limit)

    case x: ArrivedToDestination =>
      scribe.debug(s"Person ${sender.path.name} arrived to destination ${x.actorRef.path.name}. Removing it")
      people.remove(sender.path.name)
      context.stop(sender)

    case x: Any => scribe.error(s"Simulator does not understand $x from ${sender.path.name}")
  }

  def simulateStep(timeMultiplier: Double, limit: Option[Int] = None): Unit = {
    val stations: List[MetroNode] = metroGraph
      .nodes
      .filter(x => x.value.name.startsWith(Metro.StationPrefix))
      .map(x => x.toOuter)
      .toList
    for {
      startNode <- if (limit.isDefined) stations.take(limit.get) else stations
      _ = scribe.info(s"""size stationids entrance for ${startNode.name} ${stationIdsEntrance.filter{ case (k, _) => startNode.name.contains(k.name) }.values.flatten.size}""")
      startStationId <- stationIdsEntrance.filter{ case (k, _) => startNode.name.contains(k.name) }.values.flatten  // Check if <- or = needed here
      dailyEntrance: Double = startStationId.entrance / 30
      _ = scribe.debug(s"""Daily entrance for ${startNode.name}: $dailyEntrance""")
      hourMultiplier: Double = Simulator.HourDistribution((24 * (time.toDouble / (1.day.toSeconds * 1000))).toInt)
      _ = scribe.debug(s"""hour multiplier $hourMultiplier""")
      people: Double = (dailyEntrance / (1.day.toSeconds * timeMultiplier) + startNode.partialPerson) * hourMultiplier
      integerPart: Int = people.toInt
      floatPart: Double = people - integerPart
      _ = if (floatPart > 0) startNode.setPartialPerson(floatPart)
      _ = scribe.debug(s"""Persons spawning in ${startStationId.id}: $people""")
      otherStations: List[MetroNode] = stations.filter(x => !x.name.equals(startNode.name))
      dist: Map[MetroNode, Double] = Simulator.buildStationDistribution(otherStations, stationIdsEntrance)
      _ <-  1 to integerPart
      randomized: Double = random.nextLong(dist.values.sum.toLong)
      // TODO: select destination based on station daily entrance rather than randomly
      //_ = scribe.info(s"""Randomized $randomized""")
      destinationNode: MetroNode = getRandomStation(dist, randomized)
      //destinationNode = otherStations(random.nextInt(otherStations.size))
      startNodeGraph = metroGraph.nodes.filter(x => x.value.name == startNode.name).head
      destinationNodeGraph = metroGraph.nodes.filter(x => x.value.name == destinationNode.name).head
      journey: Option[metroGraph.Path] = startNodeGraph shortestPathTo destinationNodeGraph
      path = journey
        .get
        .nodes
        .map(x => stationActors.filter(y => y.path.name == x.name).head)
        .toSeq
      _ = if (startNode.name.contains("SOL")) scribe.info(s"""Person going to $journey""")
      _ = scribe.debug(s"""Person going to $journey""")
      uuid = java.util.UUID.randomUUID.toString
      person = actorSystem.actorOf(Props(classOf[Person], self, path, timeMultiplier), uuid)
      _ = this.people.addOne(person.path.name, person)
      _ = this.simulationPeople += 1
    } yield person
  }

}

object Simulator {

  val HourDistribution: Map[Int, Double] = Map[Int, Double](
    6 -> 1,
    7 -> 2,
    8 -> 6,
    9 -> 11,
    10 -> 7,
    11 -> 5,
    12 -> 6,
    13 -> 6,
    14 -> 6,
    15 -> 8,
    16 -> 6,
    17 -> 7,
    18 -> 8,
    19 -> 8,
    20 -> 7,
    21 -> 5,
    22 -> 3,
    23 -> 2
  )

  def buildStationDistribution(stations: List[MetroNode], stationIdsEntrance: Map[StationIds, Option[Entrance]]): Map[MetroNode, Double] = {
    stations.foldLeft(Map[MetroNode, Double]()){(acc, station) => {
      val startStationId = stationIdsEntrance.filter{ case (k, _) => station.name.contains(k.name) }.values.flatten
      if (startStationId.isEmpty) {
        //println(s"""Empy startstation id $station""")
        acc
      }
      else {
        val entrance: Double = acc.values.sum + startStationId.head.entrance
        //println(s"""Entrance $entrance""")
        acc ++ Map(station -> entrance)
      }
    }}
  }

  @tailrec
  def getRandomStation(distribution: Map[MetroNode, Double], x: Double): MetroNode = {
    if (distribution.nonEmpty) {
      val currentStation = distribution.head
      if (x > currentStation._2) getRandomStation(distribution.tail, x)
      else currentStation._1
    } else {
      distribution.head._1
    }
  }
}
