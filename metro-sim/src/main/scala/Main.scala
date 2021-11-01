import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import akka.stream.ActorMaterializer

import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}

object Main extends App {

  implicit val actorSystem = ActorSystem("system")
  implicit val materializer = ActorMaterializer()

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
  readMessages()

  def readMessages(): Unit =
    for (ln <- io.Source.stdin.getLines) ln match {
      case "" =>
        actorSystem.terminate()
        return
      case other => WebSocket.sendText(other)
    }
}