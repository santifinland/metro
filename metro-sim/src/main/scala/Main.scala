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
import parser.{MetroParser, Path}
import pureconfig._
import pureconfig.generic.auto._
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import utils.WebSocket
import scalax.collection.edge.Implicits._
import scribe.Level


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
    .withHandler(minimumLevel = Some(Level.Debug))
    .replace()
  val timeMultiplier = 1 / metroConf.timeMultiplier
  scribe.info(s"Time multiplier: $timeMultiplier")
  Thread.sleep(4000)

  // Metro net lines info
  val source = scala.io.Source.fromFile("data/tramos.json")
  val metro: String = try source.mkString finally source.close()
  val metroParser = new MetroParser(metro)
  val paths: Seq[Path] = metroParser.parseMetro(metro)

  // Sort stations by order inside each line
  val lines: Map[String, Seq[Path]] = paths.groupBy(l => l.features.numerolineausuario)
  val sortedLines: Map[String, Seq[Path]] = lines.map { case (lineName, paths) => lineName -> Path.sortLines(paths) }

  // Build metro graph
  val metroGraph: Graph[String, WDiEdge] = new Metro(sortedLines).buildMetroGraph()

  // Build Line and User Interface actor
  val ui: ActorRef = actorSystem.actorOf(Props[UI], "ui")

  // Iterate over lines
  val stationActors: Iterable[(String, Seq[ActorRef])] = sortedLines.flatMap { case (l: String, _) =>
    scribe.info(s"Handling line $l")
    val L: ActorRef = actorSystem.actorOf(Props(classOf[Line], ui), "L" + l)  // Build line actors for this line
    L ! "Start"  // Start line with any message: i.e. "Start"
   Station.buildStation(actorSystem, sortedLines.filter{ case (line, _) => "L" + line == L.path.name }, L)  // Line sta.
  }

  // Initialize simulation with trains
  val random = new Random
  val allActors: List[ActorRef] = stationActors.flatMap { case (_, xs) => xs }.toList
  val percentageOfStationsWithTrains: Int = 50
  val trains: Iterable[ActorRef]  = Train.buildTrains(actorSystem, lines, allActors, percentageOfStationsWithTrains,
    timeMultiplier)
  println(trains)

  // Start simulation creating people and computing shortestPath
  val simulator: Simulator = new Simulator(actorSystem, stationActors.toMap, sortedLines, metroGraph)
  var i = 0
  while (i < 300) {
    i += 1
    scribe.info(s"iteración $i")
    Thread.sleep((100000L * timeMultiplier).toLong)
    simulator.simulate(timeMultiplier)
  }
}
