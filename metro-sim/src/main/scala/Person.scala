// Metro. SDMT

import scala.concurrent.duration.{FiniteDuration, SECONDS}
import akka.actor.{Actor, ActorRef}

import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages._


class Person(simulator: ActorRef, path: Seq[ActorRef], timeMultiplier: Double) extends Actor {

  val WaitAtStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)
  val WaitForStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)
  val WaitAtPlatform: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)

  var currentNode: ActorRef = path.head
  var nextNode: Option[ActorRef] = None

  override def preStart(): Unit = {
    scribe.debug(s"Person ${self.path.name} to ${path.last.path.name} wants to enter ${path.head.path.name}")
    scribe.debug(s"Person path: ${path}")
    path.head ! RequestEnterStation
  }

  def receive: Receive = {

    case AcceptedEnterStation =>
      if (currentNode.path.name.startsWith(Metro.PlatformPrefix)) {
        currentNode ! ExitPlatform
      }
      currentNode = sender
      scribe.debug(s"Person ${self.path.name} entered station ${currentNode.path.name}")
      nextNode = {
        if (path.indexOf(currentNode) == path.size - 1) {
          scribe.debug(s"Person ${self.path.name} arrived final destination")
          currentNode ! ExitStation
          simulator ! ArrivedToDestination
          None
        } else {
          Some(path(path.indexOf(currentNode) + 1))
        }
      }
      if (nextNode.isDefined) {
        scribe.debug(s"Person ${self.path.name} now has next node ${nextNode.get.path.name}")
        nextNode.get !
          (if (nextNode.get.path.name.startsWith(Metro.StationPrefix)) RequestEnterStation else RequestEnterPlatform)
      }

    case NotAcceptedEnterStation =>
      scribe.debug(s"Person ${self.path.name} not accepted in station ${sender.path.name}")
      system.scheduler.scheduleOnce(WaitForStation, sender, RequestEnterStation)

    case x: AcceptedEnterPlatform =>
      currentNode = x.actorRef
      nextNode = Some(path(path.indexOf(currentNode) + 1))
      scribe.debug(s"Person ${self.path.name} entered platform ${this.currentNode.path.name}")
      context.become(inPlatform)

    case NotAcceptedEnterPlatform =>
      scribe.debug(s"Person ${self.path.name} not accepted in platform ${sender.path.name}")
      system.scheduler.scheduleOnce(WaitAtStation, sender, RequestEnterPlatform)

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
      sender ! RequestEnterTrain(self)

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }

  def inTrain: Receive = {

    case x: ArrivedAtPlatformToPeople =>
      currentNode = x.actorRef
      nextNode = Some(path(path.indexOf(currentNode) + 1))
      scribe.debug(
        s"Person ${self.path.name} inside Train ${sender.path.name} at Platform ${x.actorRef.path.name}")
      if (nextNode.get.path.name.startsWith(Metro.StationPrefix)) {  // Person has arrived to intermediate node
        scribe.debug(s"Person ${self.path.name} to ${nextNode.get.path.name}  stopping at ${x.actorRef.path.name}")
        context.become(receive)
        sender ! ExitTrain
        currentNode ! EnteredPlatformFromTrain
        nextNode.get ! EnteredStationFromPlatform
      } else {
        scribe.debug(s"Person ${self.path.name} to ${nextNode.get.path.name} not stopping at ${x.actorRef.path.name}")
      }

    case x => scribe.warn(s"Person ${self.path.name} received unknown message $x")
  }
}


