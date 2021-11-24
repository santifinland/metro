// Metro. SDMT

import scala.concurrent.duration.{FiniteDuration, SECONDS}
import akka.actor.{Actor, ActorRef}
import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages
import messages.Messages._


class Person(path: Seq[ActorRef], timeMultiplier: Double) extends Actor {

  val WaitAtStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)

  var currentNode: ActorRef = path.head
  var nextNode: ActorRef = path.head
  //var currentStation: Option[ActorRef] = None
  //var currentPlatform: Option[ActorRef] = None
  //def nextNode: Option[ActorRef] = currentPlatform match {
    //case x: Some[ActorRef] =>  Some(path(path.indexOf(x.get) + 1))
    //case _ => None
  //}

  override def preStart(): Unit = {
    scribe.debug(s"Person ${self.path.name} to ${path.last.path.name} wants to enter ${path.head.path.name}")
    scribe.debug(s"Person path: ${path}")
    path.head ! RequestEnterStation
  }

  def receive: Receive = {

    case AcceptedEnterStation =>
      currentNode = sender
      nextNode = path(path.indexOf(currentNode) + 1)
      scribe.debug(s"Person ${self.path.name} entered station ${currentNode.path.name}")
      scribe.debug(s"Person ${self.path.name} now has next node ${nextNode.path.name}")
      nextNode ! (if (nextNode.path.name.startsWith(Metro.StationPrefix)) RequestEnterStation else RequestEnterPlatform)

    case x: AcceptedEnterPlatform =>
      currentNode = x.actorRef
      nextNode = path(path.indexOf(currentNode) + 1)
      scribe.debug(s"Person ${self.path.name} entered platform ${this.currentNode.path.name}")
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
      currentNode = x.actorRef
      nextNode = path(path.indexOf(currentNode) + 1)
      scribe.debug(
        s"Person ${self.path.name} inside Train ${sender.path.name} at Platform ${x.actorRef.path.name}")
      if (x.actorRef.path.name == path.last.path.name) {
        scribe.debug(s"Person ${self.path.name} arrived final destination")
        sender ! ExitTrain
        context.stop(self)
      } else if (nextNode.path.name.startsWith(Metro.StationPrefix)) {  // Person has arrived to intermediate node
        scribe.debug(s"Person ${self.path.name} to ${nextNode.path.name}  stopping at ${x.actorRef.path.name}")
        sender ! ExitTrain
        context.become(receive)
        nextNode ! RequestEnterStation
      } else {
        scribe.debug(s"Person ${self.path.name} to ${nextNode.path.name} not stopping at ${x.actorRef.path.name}")
      }

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }
}


