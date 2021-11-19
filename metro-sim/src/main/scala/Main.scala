// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Random, Success}

import akka.actor.{ActorRef, ActorSystem, Props}
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import akka.stream.Materializer
import akka.util.Timeout
import parser.{MetroParser, Path}
import pureconfig._
import pureconfig.generic.auto._
import utils.WebSocket


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

  // Build Line and User Interface actor
  val ui: ActorRef = actorSystem.actorOf(Props[UI], "ui")
  val L10a: ActorRef = actorSystem.actorOf(Props(classOf[Line], ui), "10a")
  L10a ! "Start"
  val L11: ActorRef = actorSystem.actorOf(Props(classOf[Line], ui), "11")
  L11 ! "Start"

  // Build stations and its connections: the metro network
  val stationActors10a: Iterable[(String, Seq[ActorRef])] = Station.buildStation(
    actorSystem, sortedLines.filter{ case (line, _) => line == L10a.path.name }, L10a)
  val stationActors11: Iterable[(String, Seq[ActorRef])] = Station.buildStation(
    actorSystem, sortedLines.filter{ case (line, _) => line == L11.path.name }, L11)
  val stationActors: Iterable[(String, Seq[ActorRef])] = stationActors10a ++ stationActors11

  // Initialize simulation with trains
  val random = new Random
  val allActors: List[ActorRef] = stationActors.flatMap { case (_, xs) => xs }.toList
  val trains: Iterable[ActorRef]  = Train.buildTrains(actorSystem, lines, allActors, 50, timeMultiplier)
  println(trains)

  val simulator: Simulator = new Simulator(actorSystem, stationActors.toMap, sortedLines)
  var i = 0
  while (i < 300) {
    i += 1
    scribe.info(s"iteración $i")
    Thread.sleep((100000L * timeMultiplier).toLong)
    simulator.simulate(timeMultiplier)
  }
}
