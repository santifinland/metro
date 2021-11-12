// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}

import akka.actor.{ActorSystem, Props}
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import akka.stream.{ActorMaterializer, Materializer}
import akka.util.Timeout
import Messages.{Move, Next}
import pureconfig._
import pureconfig.generic.auto._


object Main extends App {

  // Read configuration
  val conf = ConfigSource.default.load[MetroConf]
  val metroConf = conf.toOption.get
  print(metroConf.lines)

  // Metro net lines info
  val source = scala.io.Source.fromFile("data/tramos.json")
  val metro: String = try source.mkString finally source.close()
  val metroParser = new MetroParser(metro)
  val res = metroParser.parseMetro(metro)
  println(res)

  implicit val timeout: Timeout = Timeout(10.seconds)
  implicit val actorSystem: ActorSystem = ActorSystem("system")
  implicit val materializer: Materializer = Materializer.matFromSystem

  val trainOne = actorSystem.actorOf(Props(classOf[Train], "BLUE"), "TrainOne")
  val trainTwo = actorSystem.actorOf(Props(classOf[Train], "RED"), "TrainTwo")
  val trainThree = actorSystem.actorOf(Props(classOf[Train], "YELLOW"), "TrainThree")
  val jardin = actorSystem.actorOf(Props[Station], "Jardin")
  val campo = actorSystem.actorOf(Props[Station], "Campo")
  val batan = actorSystem.actorOf(Props[Station], "Batan")
  val lago = actorSystem.actorOf(Props[Station], "Lago")
  campo ! Next(batan)
  batan ! Next(lago)
  lago ! Next(campo)
  trainOne ! Move(campo)
  Thread.sleep(1)
  trainTwo ! Move(campo)
  trainThree ! Move(campo)


  val route = path("ws") {
    handleWebSocketMessages(WebSocket.listen())
  }

  Http().bindAndHandle(route, "0.0.0.0", 8081).onComplete {
    case Success(binding)   =>  println(s"Listening on ${binding.localAddress.getHostString}:${binding.localAddress.getPort}.")
    case Failure(exception) => throw exception
  }

  while (true) {
    Thread.sleep(1000)
    WebSocket.sendText(s"""{"train": "1", "station": "Opera", "slot": "station"}""")
    Thread.sleep(1000)
    WebSocket.sendText(s"""{"train": "1", "station": "Ppio", "slot": "station"}""")
  }
}