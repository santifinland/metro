// Metro. SDMT

import scala.concurrent.duration.{FiniteDuration, SECONDS}

import akka.actor.{Actor, ActorRef}
import Main.actorSystem.dispatcher
import Main.materializer.system
import messages.Messages._


class Person(destination: ActorRef, timeMultiplier: Double) extends Actor {

  val WaitAtStation: FiniteDuration = FiniteDuration((5 * timeMultiplier).toLong, SECONDS)

  var currentPlatform: Option[ActorRef] = None

  def receive: Receive = {

    case x: EnterPlatform =>
      scribe.debug(s"Person ${self.path.name} want to enter platform ${x.actorRef.path.name}")
      x.actorRef ! RequestEnterPlatform(self)

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
      if (x.actorRef.path.name == destination.path.name) {
        scribe.debug(s"Person ${self.path.name} arrived destination")
        sender ! ExitTrain
        context.stop(self)
      }

    case _ => scribe.warn(s"Person ${self.path.name} received unknown message")
  }
}
