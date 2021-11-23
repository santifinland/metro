// Metro. SDMT

import scala.concurrent.duration.{FiniteDuration, SECONDS}

import akka.actor.{Actor, ActorRef}
import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages._


class Person(path: Seq[ActorRef], timeMultiplier: Double) extends Actor {

  val WaitAtStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)

  var currentStation: Option[ActorRef] = None
  def nextNode: ActorRef = path(path.indexOf(this.currentStation.get) + 1)
  var currentPlatform: Option[ActorRef] = None

  override def preStart(): Unit = {
    scribe.debug(s"Person ${self.path.name} to ${path.last.path.name} wants to enter ${path.head.path.name}")
    path.head ! RequestEnterStation
  }

  def receive: Receive = {

    case AcceptedEnterStation =>
      this.currentStation = Some(sender)
      scribe.debug(s"Person ${self.path.name} entered station ${this.currentStation.get.path.name}")
      nextNode ! (if (nextNode.path.name.startsWith(Metro.StationPrefix)) RequestEnterStation else RequestEnterPlatform)

    case x: AcceptedEnterPlatform =>
      this.currentPlatform = Some(x.actorRef)
      scribe.debug(s"Person ${self.path.name} entered platform ${this.currentPlatform.get.path.name}")
      context.become(inPlatform)

    case NotAcceptedEnterPlatform =>
      scribe.debug(s"Person ${self.path.name} not accepted in platform ${sender.path.name}")
      system.scheduler.scheduleOnce(WaitAtStation, sender, RequestEnterTrain(self))

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }

  def inPlatform: Receive = {

    case x: TrainInPlatform =>
      scribe.debug(
        s"Train ${x.actorRef.path.name} available for ${self.path.name} at platform ${sender.path.name}")
      x.actorRef ! RequestEnterTrain(self)

    case x: AcceptedEnterTrain =>
      scribe.debug(
        s"Person ${self.path.name} inside Train ${sender.path.name} at platform ${x.actorRef.path.name}")
      x.actorRef ! ExitPlatform
      context.become(inTrain)

    case NotAcceptedEnterTrain =>
      scribe.debug(s"Person ${self.path.name} not accepted in Train")

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }

  def inTrain: Receive = {

    case x: ArrivedAtPlatformToPeople =>
      scribe.debug(
        s"Person ${self.path.name} inside Train ${sender.path.name} at Platform ${x.actorRef.path.name}")
      if (x.actorRef.path.name == nextNode.path.name) {
        scribe.debug(s"Person ${self.path.name} arrived destination")
        sender ! ExitTrain
        context.stop(self)
      }

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }
}


