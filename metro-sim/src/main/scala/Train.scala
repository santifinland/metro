// Metro. SDMT

import java.util.Calendar
import scala.util.Random

import akka.actor.{Actor, ActorRef}
import Messages.{AcceptedEnterTrain, ArrivedAtStation, ArrivedAtStationToPeople, ExitTrain, Free, Full, GetNext, Move, Next, NotAcceptedEnterTrain, RequestEnterTrain, Reserve, Reserved}


class Train(lines: Seq[Line], color: String) extends Actor {

  var station: Option[ActorRef] = None
  var nextStation: Option[ActorRef] = None
  var x: Double = 0
  var y: Double = 0
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 1000

  def receive: Receive = {

    case x: Move =>
      this.printar(s" Train ${self.path.name} wants to move from ${x.actorRef.path.name}")
      x.actorRef ! Reserve

    case x: Reserved =>

      if (this.station.isEmpty) {
        this.station = Some(x.actorRef)
        this.printar(s" Train ${self.path.name} starting move at ${station.get.path.name}")
        this.x = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.x
        this.y = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.y
        WebSocket.sendText(
          s"""{"message": "newTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
        Thread.sleep(Random.between(1000, 3000))  // Waiting at the station
        this.station.get ! GetNext

      } else {
        this.printar(
          s""" Train ${self.path.name} departing from ${station.get.path.name} with ${people.size} passengers""")
        this.nextStation = Some(x.actorRef)
        this.station.get ! Free
        Thread.sleep(Random.between(6000, 10000))  // Moving to next station
        this.printar(s"    Train ${self.path.name} llegando a ${nextStation.get.path.name}")
        this.station = this.nextStation
        this.station.get ! ArrivedAtStation
        this.people.foreach {case (_, actor) => actor ! ArrivedAtStationToPeople(this.station.get) }
        this.x = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.x
        this.y = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.y
        this.sendMovement()
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

    case x: RequestEnterTrain =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        sender ! AcceptedEnterTrain(this.station.get)
      } else {
        sender ! NotAcceptedEnterTrain
      }

    case ExitTrain =>
      this.printar(s" Person ${sender.path.name} exits train ${self.path.name}")
      people.remove(sender.path.name)

    case _ => printar("Other")
  }

  def printar(x: String): Unit = this.color match {
    case "BLUE" => println(Console.BLUE + Calendar.getInstance().getTime + x)
    case "RED" => println(Console.RED + Calendar.getInstance().getTime + x)
    case "YELLOW" => println(Console.YELLOW + Calendar.getInstance().getTime + x)
    case _ => println(x)
  }

  def sendMovement(): Unit =
    WebSocket.sendText(
      s"""{"message": "moveTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
}
