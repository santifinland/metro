// Metro. SDMT

import scala.concurrent.duration.{DurationInt, FiniteDuration, SECONDS}
import scala.util.Random

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages._
import parser.Path
import utils.WebSocket


class Train(allPaths: Seq[Path], timeMultiplier: Double) extends Actor {

  val TimeBetweenPlatforms: FiniteDuration = FiniteDuration((Random.between(90, 180) * timeMultiplier).toLong, SECONDS)
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
      x.actorRef ! ReservePlatform

    case x: PlatformReserved =>

      if (this.platform.isEmpty) {
        this.platform = Some(x.actorRef)
        scribe.debug(s" Train ${self.path.name} starting move at ${platform.get.path.name}")
        val platformPath = allPaths.filter(
          p => Metro.platformName(p.features.denominacion, p.features.codigoanden) == this.platform.get.path.name).head
        this.x = platformPath.x
        this.y = platformPath.y
        WebSocket.sendText(
          s"""{"message": "newTrain", "train": "${self.path.name}", "x": ${this.x}, "y": ${this.y}}""")
        system.scheduler.scheduleOnce(TimeBetweenPlatforms, this.platform.get, GetNextPlatform)

      } else {
        scribe.debug(
          s""" Train ${self.path.name} departing from ${platform.get.path.name} with ${people.size} passengers""")
        this.nextPlatform = Some(x.actorRef)
        this.platform.get ! LeavingPlatform
        system.scheduler.scheduleOnce(TimeBetweenPlatforms, self, TrainArrivedAtPlatform)
      }

    case TrainArrivedAtPlatform =>
      scribe.debug(s"    Train ${self.path.name} arriving to ${nextPlatform.get.path.name}")
      this.platform = this.nextPlatform
      this.platform.get ! ArrivedAtPlatform
      this.people.foreach {case (_, actor) => actor ! ArrivedAtPlatformToPeople(this.platform.get) }
      val platformPath = allPaths.filter(
        p => Metro.platformName(p.features.denominacion, p.features.codigoanden) == this.platform.get.path.name).head
      this.x = platformPath.x
      this.y = platformPath.y
      this.sendMovement()
      this.nextPlatform = None
      system.scheduler.scheduleOnce(TimeOpenDoors, this.platform.get, GetNextPlatform)  // Open doors

    case x: NextPlatform =>
      this.nextPlatform = Some(x.actorRef)
      scribe.debug(s" Train ${self.path.name} knows next platform ${x.actorRef.path.name}")
      this.nextPlatform.get ! ReservePlatform

    case x: FullPlatform =>
      if (this.platform.isEmpty) {
        scribe.debug(s" Train ${self.path.name} no puede comenzar su movimiento")
      } else {
        scribe.debug(s" Train ${self.path.name} esperando en ${platform.get.path.name}")
      }
      system.scheduler.scheduleOnce(5.seconds, x.actorRef, ReservePlatform)

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

  def buildTrains(actorSystem: ActorSystem, allPaths: Seq[Path], linePlatforms: Seq[ActorRef],
                  n: Int, timeMultiplier: Double): Iterable[ActorRef] = {
    for {
      _ <- 1 to (n * linePlatforms.length / 100) + 1
      start: ActorRef = linePlatforms(random.nextInt(linePlatforms.size))
      message = Some(Move(start))
      uuid = java.util.UUID.randomUUID.toString
      train = actorSystem.actorOf(Props(classOf[Train], allPaths, timeMultiplier), uuid)
      _ = train ! message.get
    } yield train
  }
}
