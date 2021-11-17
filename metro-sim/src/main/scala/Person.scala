// Metro. SDMT

import Messages._
import akka.actor.{Actor, ActorRef}


class Person(destination: ActorRef) extends Actor {

  var currentStation: Option[ActorRef] = None

  def receive: Receive = {

    case x: EnterStation =>
      println(Console.WHITE + s"Person ${self.path.name} want to start in station ${x.actorRef.path.name}")
      x.actorRef ! RequestEnterStation(self)

    case x: AcceptedEnterStation =>
      this.currentStation = Some(x.actorRef)
      println(Console.WHITE + s"Person ${self.path.name} entered station ${this.currentStation.get.path.name}")
      context.become(inStation)

    case NotAcceptedEnterStation =>
      println(Console.WHITE + s"Person ${self.path.name} not accepted in station ${sender.path.name}")
      Thread.sleep(5000)
      sender ! RequestEnterStation(self)

    case _ => println(Console.WHITE + s"Person ${self.path.name} received unknown message")
  }

  def inStation: Receive = {

    case x: TrainInStation =>
      println(Console.WHITE + s"Train ${x.actorRef.path.name} available for ${self.path.name} at station ${sender.path.name}")
      x.actorRef ! RequestEnterTrain(self)

    case x: AcceptedEnterTrain =>
      println(
        Console.WHITE + s"Person ${self.path.name} inside Train ${sender.path.name} at station ${x.actorRef.path.name}")
      x.actorRef ! ExitStation
      context.become(inTrain)

    case NotAcceptedEnterTrain =>
      println(Console.WHITE + s"Person ${self.path.name} not accepted in Train")
  }

  def inTrain: Receive = {

    case x: ArrivedAtStationToPeople =>
      println(Console.WHITE + s"Person ${self.path.name} inside Train ${sender.path.name} at Station ${x.actorRef.path.name}")
      if (x.actorRef.path.name == destination.path.name) {
        println(Console.WHITE + s"Person ${self.path.name} arrived destination")
        sender ! ExitTrain
        context.stop(self)
      }
  }
}
