// Metro. SDMT

import scala.concurrent.duration.{DurationInt, FiniteDuration, SECONDS}
import scala.util.Random

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages._
import parser.Path
import utils.WebSocket


class Train(lines: Seq[Path], timeMultiplier: Double) extends Actor {

  val TimeBetweenStations: FiniteDuration = FiniteDuration((Random.between(90, 180) * timeMultiplier).toLong, SECONDS)
  val TimeOpenDoors: FiniteDuration = FiniteDuration((Random.between(20, 40) * timeMultiplier).toLong, SECONDS)

  var platform: Option[ActorRef] = None
  var nextPlatform: Option[ActorRef] = None
  var x: Double = 0
  var y: Double = 0
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 1000

  def receive: Receive = {

    case x: Move =>
      scribe.debug(s" Train ${self.path.name} wants to move from ${x.actorRef.path.name}")
      x.actorRef ! Reserve

    case x: Reserved =>

      if (this.platform.isEmpty) {
        this.platform = Some(x.actorRef)
        scribe.debug(s" Train ${self.path.name} starting move at ${platform.get.path.name}")
        this.x = lines.filter(l => l.features.codigoanden.toString == this.platform.get.path.name).head.x
        this.y = lines.filter(l => l.features.codigoanden.toString == this.platform.get.path.name).head.y
        WebSocket.sendText(
          s"""{"message": "newTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
        system.scheduler.scheduleOnce(TimeBetweenStations, this.platform.get, GetNext)

      } else {
        scribe.info(
          s""" Train ${self.path.name} departing from ${platform.get.path.name} with ${people.size} passengers""")
        this.nextPlatform = Some(x.actorRef)
        this.platform.get ! Free
        system.scheduler.scheduleOnce(TimeBetweenStations, self, TrainArrivedAtStation)
      }

    case TrainArrivedAtStation =>
      scribe.debug(s"    Train ${self.path.name} arriving to ${nextPlatform.get.path.name}")
      this.platform = this.nextPlatform
      this.platform.get ! ArrivedAtStation
      this.people.foreach {case (_, actor) => actor ! ArrivedAtStationToPeople(this.platform.get) }
      this.x = lines.filter(l => l.features.codigoanden.toString == this.platform.get.path.name).head.x
      this.y = lines.filter(l => l.features.codigoanden.toString == this.platform.get.path.name).head.y
      this.sendMovement()
      this.nextPlatform = None
      system.scheduler.scheduleOnce(TimeOpenDoors, this.platform.get, GetNext)  // Open doors



    case x: Next =>
      this.nextPlatform = Some(x.actorRef)
      scribe.debug(s" Train ${self.path.name} knows next platform ${x.actorRef.path.name}")
      this.nextPlatform.get ! Reserve

    case x: Full =>
      if (this.platform.isEmpty) {
        scribe.debug(s" Train ${self.path.name} no puede comenzar su movimiento")
      } else {
        scribe.debug(s" Train ${self.path.name} esperando en ${platform.get.path.name}")
      }
      system.scheduler.scheduleOnce(5.seconds, x.actorRef, Reserve)

    case x: RequestEnterTrain =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        sender ! AcceptedEnterTrain(this.platform.get)
      } else {
        scribe.warn(s" Train ${self.path.name} over capacity at ${platform.get.path.name}")
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
                  actors: List[ActorRef], n: Int, timeMultiplier: Double): Iterable[ActorRef] = {
    for {
      (_: String, lx: Seq[Path]) <- lines
      _ <- 1 to (n * lx.length / 100)
      start = lx.toList(random.nextInt(lx.toList.size)).features.codigoanden.toString if lx.toList.nonEmpty
      destination = actors.filter(x => x.path.name == start)
      if destination.nonEmpty
      message = Some(Move(destination.head))
      uuid = java.util.UUID.randomUUID.toString
      train = actorSystem.actorOf(Props(classOf[Train], lx, timeMultiplier), uuid)
      _ = train ! message.get
    } yield train
  }
}
