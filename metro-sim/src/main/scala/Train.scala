// Metro. SDMT

import java.util.Calendar
import scala.util.Random

import akka.actor.{Actor, ActorRef}
import Messages.{Free, Full, GetNext, Move, Next, Reserve, Reserved}


class Train(color: String) extends Actor {

  var station: Option[ActorRef] = None
  var nextStation: Option[ActorRef] = None

  def receive: Receive = {

    case x: Move =>
      this.printar(s" Train ${self.path.name} wants to move from ${x.actorRef.path.name}")
      x.actorRef ! Reserve

    case x: Reserved =>

      if (this.station.isEmpty) {
        this.station = Some(x.actorRef)
        this.printar(s" Train ${self.path.name} starting move at ${station.get.path.name}")
        WebSocket.sendText(
          s"""{"message": "newTrain", "train": ${self.path.name}, "station": "${this.station.get.path.name}"}""")
        Thread.sleep(Random.between(1000, 3000))  // Waiting at the station
        this.station.get ! GetNext

      } else {
        this.printar(s" Train ${self.path.name} Saliendo de ${station.get.path.name}")
        this.nextStation = Some(x.actorRef)
        this.station.get ! Free
        Thread.sleep(Random.between(6000, 10000))  // Moving to next station
        this.printar(s"    Train ${self.path.name} llegando a ${nextStation.get.path.name}")
        this.station = this.nextStation
        this.sendMovement(self.path.name)
        this.nextStation = None
        Thread.sleep(Random.between(1000, 3000))  // Waiting at the station
        this.station.get ! GetNext
      }

    case x: Next =>
      this.nextStation = Some(x.actorRef)
      this.printar(s" Train ${self.path.name} knows next station ${x.actorRef.path.name}")
      this.nextStation.get ! Reserve

    case x: Full =>
      if (this.station.isEmpty) {
        this.printar(s" Train ${self.path.name} no puede comenzar su movimiento")
      } else {
        this.printar(s" Train ${self.path.name} esperando en ${station.get.path.name}")
      }
      Thread.sleep(3000)
      x.actorRef ! Reserve

    case _ => printar("Other")
  }

  def printar(x: String): Unit = this.color match {
    case "BLUE" => println(Console.BLUE + Calendar.getInstance().getTime + x)
    case "RED" => println(Console.RED + Calendar.getInstance().getTime + x)
    case "YELLOW" => println(Console.YELLOW + Calendar.getInstance().getTime + x)
    case _ => println(x)
  }

  def sendMovement(train: String): Unit = {
    print(s"Sending movement for train ${train}")
    WebSocket.sendText(
      s"""{"message": "moveTrain", "train": ${self.path.name}, "station": "${this.station.get.path.name}"}""")
  }
}
