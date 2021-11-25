// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Random, Success}
import Main.metroGraph
import akka.actor.{ActorRef, ActorSystem, Props}
import akka.event.Logging.{Debug, DebugLevel}
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import akka.stream.Materializer
import akka.util.Timeout
import messages.Messages.NextPlatform
import parser.{MetroParser, Path}
import pureconfig._
import pureconfig.generic.auto._
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.WebSocket
import scalax.collection.edge.Implicits._
import scribe.Level

import scala.collection.immutable


object Main extends App {

  implicit val timeout: Timeout = Timeout(10.seconds)
  implicit val actorSystem: ActorSystem = ActorSystem("system")
  implicit val materializer: Materializer = Materializer.matFromSystem

  // Create WebSocket server
  val route = path("ws") { handleWebSocketMessages(WebSocket.listen()) }
  Http().newServerAt("0.0.0.0", 8081).bind(route).onComplete {
    case Success(binding) => println(s"Listening on ${binding.localAddress.getHostString}:${binding.localAddress.getPort}.")
    case Failure(exception) => throw exception
  }

  // Read configuration
  val conf = ConfigSource.default.load[MetroConf]
  val metroConf = conf.toOption.get
  scribe.info(s"Metro")
  scribe.Logger.root
    .clearHandlers()
    .clearModifiers()
    .withHandler(minimumLevel = Some(Level.Info))
    .replace()
  val timeMultiplier = 1 / metroConf.timeMultiplier
  scribe.info(s"Time multiplier: $timeMultiplier")
  Thread.sleep(4000)

  // Metro net lines info
  val source = scala.io.Source.fromFile("data/tramos.json")
  val metro: String = try source.mkString finally source.close()
  val metroParser = new MetroParser(metro)
  val paths: Seq[Path] = metroParser.parseMetro(metro)

  // Sort paths by order inside each line
  val sortedLinePaths: Map[String, Seq[Path]] = paths
    .groupBy(l => l.features.numerolineausuario)
    .map { case (line, paths) => line -> Path.sortLinePaths(paths) }

  // Build metro graph
  val metroGraph: Graph[MetroNode, WDiEdge] = new Metro(sortedLinePaths).buildMetroGraph()
  val stations: List[metroGraph.NodeT] = metroGraph
    .nodes
    .filter(x => x.value.name.startsWith(Metro.StationPrefix))
    .toList

  // Build Line and User Interface actor
  val ui: ActorRef = actorSystem.actorOf(Props[UI], "ui")

  // Build Line actors
  val lineActors: Iterable[ActorRef] = sortedLinePaths
    .keys
    .map(  l => actorSystem.actorOf(Props(classOf[Line], ui), "L" + l))

  // Iterate over lines to create Station actors
  val stationActors: collection.Set[ActorRef] = metroGraph
      .nodes
      .filter(x => x.name.startsWith(Metro.StationPrefix))
      .map(x => actorSystem.actorOf(Props(classOf[Station], x.value.name), x.value.name))

  // Iterate over lines to create Platform Actors
  val platformActors: Map[ActorRef, Seq[ActorRef]] = (for {
    l: ActorRef <- lineActors
    linePlatformActors: collection.Set[ActorRef] = metroGraph
      .nodes
      .filter(x => x.lines.contains(l.path.name))
      .filter(x => x.name.startsWith(Metro.PlatformPrefix))
      .map(x => actorSystem.actorOf(Props(classOf[Platform], l, x.value.name), x.value.name))
  } yield l -> linePlatformActors.toSeq).toMap

  // Iterate over graph to set next Platform Actor for each Platform Actor
  metroGraph
    .nodes
    .filter(x => x.value.name.startsWith(Metro.PlatformPrefix))
    .foreach { x: metroGraph.NodeT => {
      // Find actor for this node. This actor will sent Next message to all its successors
      val currentActor: ActorRef = platformActors.values.flatten.filter(y => y.path.name == x.value.name).head
      // Find all successors of this node
      x
        .diSuccessors
        .filter(s => s.value.name.startsWith(Metro.PlatformPrefix))
        .foreach { z: metroGraph.NodeT => {
        // Find actor for this successor node
        val nextActor: ActorRef = platformActors.values.flatten.filter(y => y.path.name == z.value.name).head
        currentActor ! NextPlatform(nextActor)  // Send Next message to this successor node actor
      }}
    } }

  // Initialize simulation with trains
  val random = new Random
  val percentageOfStationsWithTrains: Int = 20
  val trains: Iterable[ActorRef] = platformActors.flatMap { case (_: ActorRef, linePlatforms: Seq[ActorRef]) =>
    Train.buildTrains(actorSystem, paths, linePlatforms, percentageOfStationsWithTrains, timeMultiplier)
  }

  // Start simulation creating people and computing shortestPath
  val simulator: Simulator = new Simulator(actorSystem, stationActors.toList ++ platformActors.values.flatten, metroGraph)
  simulator.simulate(timeMultiplier, Some(1))
  var i = 0
  while (i < 300) {
    i += 1
    scribe.info(s"iteración $i")
    Thread.sleep((100000L * timeMultiplier).toLong)
    simulator.simulate(timeMultiplier)
  }
}
