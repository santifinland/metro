// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}

import akka.actor.{ActorSystem, Props}
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
  val res = metroParser.parseMetro(metro)

  val trainOne = actorSystem.actorOf(Props(classOf[Train], "BLUE"), "1")
  val trainTwo = actorSystem.actorOf(Props(classOf[Train], "RED"), "2")
  val trainThree = actorSystem.actorOf(Props(classOf[Train], "YELLOW"), "3")
  val jardin = actorSystem.actorOf(Props[Station], "421")
  val campo = actorSystem.actorOf(Props[Station], "419")
  val batan = actorSystem.actorOf(Props[Station], "417")
  val lago = actorSystem.actorOf(Props[Station], "415")
  jardin ! Next(campo)
  campo ! Next(batan)
  batan ! Next(lago)
  lago ! Next(jardin)
  trainOne ! Move(campo)
  Thread.sleep(1)
  trainTwo ! Move(lago)
  trainThree ! Move(campo)


  while (true) {
    Thread.sleep(1000)
    //WebSocket.sendText(s"""{"train": "1", "station": "EMPALME", "slot": "station"}""")
    //Thread.sleep(1000)
    //WebSocket.sendText(s"""{"train": "1", "station": "CAMPAMENTO", "slot": "station"}""")
  }
}