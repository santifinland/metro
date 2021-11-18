// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.util.Random

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import Main.actorSystem.dispatcher
import Main.materializer.system
import Messages._


class Train(lines: Seq[Path]) extends Actor {

  var station: Option[ActorRef] = None
  var nextStation: Option[ActorRef] = None
  var x: Double = 0
  var y: Double = 0
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 1000

  def receive: Receive = {

    case x: Move =>
      scribe.debug(s" Train ${self.path.name} wants to move from ${x.actorRef.path.name}")
      x.actorRef ! Reserve

    case x: Reserved =>

      if (this.station.isEmpty) {
        this.station = Some(x.actorRef)
        scribe.debug(s" Train ${self.path.name} starting move at ${station.get.path.name}")
        this.x = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.x
        this.y = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.y
        WebSocket.sendText(
          s"""{"message": "newTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
        system.scheduler.scheduleOnce(Random.between(1, 3).seconds, this.station.get, GetNext)

      } else {
        scribe.info(
          s""" Train ${self.path.name} departing from ${station.get.path.name} with ${people.size} passengers""")
        this.nextStation = Some(x.actorRef)
        this.station.get ! Free
        system.scheduler.scheduleOnce(Random.between(5, 10).seconds, self, TrainArrivedAtStation)
      }

    case TrainArrivedAtStation =>
      scribe.debug(s"    Train ${self.path.name} llegando a ${nextStation.get.path.name}")
      this.station = this.nextStation
      this.station.get ! ArrivedAtStation
      this.people.foreach {case (_, actor) => actor ! ArrivedAtStationToPeople(this.station.get) }
      this.x = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.x
      this.y = lines.filter(l => l.features.codigoanden.toString == this.station.get.path.name).head.y
      this.sendMovement()
      this.nextStation = None
      system.scheduler.scheduleOnce(Random.between(1, 3).seconds, this.station.get, GetNext)  // Open doors



    case x: Next =>
      this.nextStation = Some(x.actorRef)
      scribe.debug(s" Train ${self.path.name} knows next station ${x.actorRef.path.name}")
      this.nextStation.get ! Reserve

    case x: Full =>
      if (this.station.isEmpty) {
        scribe.debug(s" Train ${self.path.name} no puede comenzar su movimiento")
      } else {
        scribe.debug(s" Train ${self.path.name} esperando en ${station.get.path.name}")
      }
      system.scheduler.scheduleOnce(3.seconds, x.actorRef, Reserve)

    case x: RequestEnterTrain =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        sender ! AcceptedEnterTrain(this.station.get)
      } else {
        scribe.warn(s" Train ${self.path.name} over capacity at ${station.get.path.name}")
        sender ! NotAcceptedEnterTrain
      }

    case ExitTrain =>
      scribe.debug(s" Person ${sender.path.name} exits train ${self.path.name}")
      people.remove(sender.path.name)

    case _ => scribe.warn("Other")
  }

  def sendMovement(): Unit =
    WebSocket.sendText(
      s"""{"message": "moveTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
}

object Train {

  val random = new Random

  def buildTrains(actorSystem: ActorSystem, lines: Map[String, Seq[Path]],
                  actors: List[ActorRef], n: Int): Iterable[ActorRef] = {
    for {
      (_: String, lx: Seq[Path]) <- lines
      _ <- 1 to (n * lx.length / 100)
      start = lx.toList(random.nextInt(lx.toList.size)).features.codigoanden.toString if lx.toList.nonEmpty
      destination = actors.filter(x => x.path.name == start)
      if destination.nonEmpty
      message = Some(Move(destination.head))
      uuid = java.util.UUID.randomUUID.toString
      train = actorSystem.actorOf(Props(classOf[Train], lx), uuid)
      _ = train ! message.get
    } yield train
  }
}
