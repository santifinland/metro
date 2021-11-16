// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}

import akka.actor.{ActorRef, ActorSystem, Props}
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import akka.stream.{ActorMaterializer, Materializer}
import akka.util.Timeout
import pureconfig._
import pureconfig.generic.auto._
import Messages.{Move, Next}


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
  print(metroConf.lines)
  Thread.sleep(4000)

  // Metro net lines info
  val source = scala.io.Source.fromFile("data/tramos.json")
  val metro: String = try source.mkString finally source.close()
  val metroParser = new MetroParser(metro)
  val paths: Seq[Line] = metroParser.parseMetro(metro)

  // Sort stations by order inside each line
  val lines: Map[String, Seq[Line]] = paths.groupBy(l => l.features.numerolineausuario)
  val sortedLines: Map[String, Seq[Line]] = lines.map { case (lineName, paths) => lineName -> this.sortLines(paths) }
  def sortLines(lines: Seq[Line]): Seq[Line] = {
    val lineHead: Seq[Line] = lines.filter(l => l.features.tipoparada == "C")
    val lineLast: Seq[Line] = lines.filter(l => l.features.tipoparada == "T")
    val linesMid: Seq[Line] = lines.filter(l => l.features.tipoparada != "C" && l.features.tipoparada != "T")
    def sortDirectionLines(lines: Seq[Line], direction: String): Seq[Line] = {
      lines
        .filter(l => l.features.sentido == direction)
        .sortBy(_.features.numeroorden)
    }
    val stationsDirectionHead = lineHead match {
      case Nil => Seq[Line]()
      case _ => sortDirectionLines(linesMid, lineHead.head.features.sentido)
    }
    val stationsDirectionLast = lineLast match {
      case Nil => Seq[Line]()
      case _ => sortDirectionLines(linesMid, lineLast.head.features.sentido)
    }
    stationsDirectionHead ++ lineHead ++ stationsDirectionLast ++ lineLast
  }

  // Build stations and its connections: the metro network
  val R: Seq[Line] = sortedLines.filter { case (line, _) => line == "R" }.head._2
  val kk = R.map(l => actorSystem.actorOf(Props[Station], l.features.codigoanden.toString))
  kk.foreach(x => println(x.path.name))
  val tt = for {
    i <- kk.indices
    next: Int = if (i + 1 < kk.length) i + 1 else 0
    currentActor: ActorRef = kk(i)
    nextActor: ActorRef = kk(next)
  } yield (currentActor, nextActor)
  tt.foreach(x => println(x._1.path.name, x._2.path.name))
  tt.foreach { case (current, next) => current ! Next(next) }

  // Build trains
  val trainOne = actorSystem.actorOf(Props(classOf[Train], paths, "BLUE"), "T1")
  val trainTwo = actorSystem.actorOf(Props(classOf[Train], paths, "RED"), "T2")
  val trainThree = actorSystem.actorOf(Props(classOf[Train], paths, "YELLOW"), "T3")

  // Start simulation
  trainOne ! Move(kk.filter(x => x.path.name == "2").head)
  Thread.sleep(1)
  trainTwo ! Move(kk.filter(x => x.path.name == "3").head)
  //trainTwo ! Move(lago)
  //trainThree ! Move(campo)


  while (true) {
    Thread.sleep(1000)
    //WebSocket.sendText(s"""{"train": "1", "station": "EMPALME", "slot": "station"}""")
    //Thread.sleep(1000)
    //WebSocket.sendText(s"""{"train": "1", "station": "CAMPAMENTO", "slot": "station"}""")
  }
}