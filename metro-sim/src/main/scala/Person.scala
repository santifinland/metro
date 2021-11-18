// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef}
import Main.actorSystem.dispatcher
import Main.materializer.system

import Messages._


class Person(destination: ActorRef) extends Actor {

  var currentStation: Option[ActorRef] = None

  def receive: Receive = {

    case x: EnterStation =>
      scribe.debug(Console.WHITE + s"Person ${self.path.name} want to start in station ${x.actorRef.path.name}")
      x.actorRef ! RequestEnterStation(self)

    case x: AcceptedEnterStation =>
      this.currentStation = Some(x.actorRef)
      scribe.debug(Console.WHITE + s"Person ${self.path.name} entered station ${this.currentStation.get.path.name}")
      context.become(inStation)

    case NotAcceptedEnterStation =>
      scribe.debug(Console.WHITE + s"Person ${self.path.name} not accepted in station ${sender.path.name}")
      system.scheduler.scheduleOnce(5.seconds, sender, RequestEnterTrain(self))

    case _ => scribe.debug(Console.WHITE + s"Person ${self.path.name} received unknown message")
  }

  def inStation: Receive = {

    case x: TrainInStation =>
      scribe.debug(Console.WHITE + s"Train ${x.actorRef.path.name} available for ${self.path.name} at station ${sender.path.name}")
      x.actorRef ! RequestEnterTrain(self)

    case x: AcceptedEnterTrain =>
      scribe.debug(
        Console.WHITE + s"Person ${self.path.name} inside Train ${sender.path.name} at station ${x.actorRef.path.name}")
      x.actorRef ! ExitStation
      context.become(inTrain)

    case NotAcceptedEnterTrain =>
      scribe.debug(Console.WHITE + s"Person ${self.path.name} not accepted in Train")
  }

  def inTrain: Receive = {

    case x: ArrivedAtStationToPeople =>
      scribe.debug(Console.WHITE + s"Person ${self.path.name} inside Train ${sender.path.name} at Station ${x.actorRef.path.name}")
      if (x.actorRef.path.name == destination.path.name) {
        scribe.debug(Console.WHITE + s"Person ${self.path.name} arrived destination")
        sender ! ExitTrain
        context.stop(self)
      }
  }
}
