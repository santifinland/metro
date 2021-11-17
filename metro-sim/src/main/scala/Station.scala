// Metro. SDMT

import java.util.Calendar

import akka.actor.{Actor, ActorRef}
import Messages.{AcceptedEnterStation, ArrivedAtStation, ExitStation, Free, Full, GetNext, Next, NotAcceptedEnterStation, RequestEnterStation, Reserve, Reserved, TrainInStation}


class Station extends Actor {

  var next: Option[ActorRef] = None
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 200

  def receive: Receive = {
    case x: Next =>
      this.next = Some(x.actorRef)
      println(Console.WHITE + s"Setting station ${self.path.name} to empty mode")
      context.become(empty)
    case _ => println(Console.WHITE + "Next station not set yet")
  }

  def full: Receive = {

    case Reserve =>
      println(Console.WHITE + s"${Calendar.getInstance().getTime} Station ${self.path.name} is not Free!")
      sender ! Full(self)

    case Free =>
      context.become(empty)
      println(
        Console.WHITE + s"${Calendar.getInstance().getTime} Station ${self.path.name} freed by ${sender.path.name}!")

    case GetNext => sender ! Next(this.next.get)

    case ArrivedAtStation =>
      println(
        Console.WHITE + s"${Calendar.getInstance().getTime} Train ${sender.path.name} arrived to ${self.path.name}")
      this.people.foreach { case(_, p) => p ! TrainInStation(sender)}

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        sender ! AcceptedEnterStation(self)
      } else {
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any => println(Console.WHITE + s"Full Station does not understand $x")
  }

  def empty: Receive = {

    case Reserve =>
      println(
        Console.WHITE + s"${Calendar.getInstance().getTime} Station ${self.path.name} reserved by ${sender.path.name}!")
      sender ! Reserved(self)
      context.become(full)

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        sender ! AcceptedEnterStation(self)
      } else {
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any =>  println(Console.WHITE + s"Emtpy Station does not understand message $x")
  }
}
