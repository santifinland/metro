// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._
import parser.Path


class Platform(line: ActorRef, name: String) extends Actor {

  var next: Option[ActorRef] = None
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 300

  def receive: Receive = {
    case x: Next =>
      this.next = Some(x.actorRef)
      scribe.debug(s"Setting platform ${self.path.name} to empty mode. Next actor ${x.actorRef.path.name}")
      context.become(empty)
      scheduler.scheduleAtFixedRate(3.seconds, 10.seconds)( new Runnable {
        override def run(): Unit = line ! PeopleInPlatform(people.size)
      })
    case _ => scribe.warn("Next platform not set yet")
  }

  def full: Receive = {

    case Reserve =>
      scribe.debug(s"Platform $name is not Free!")
      sender ! Full(self)

    case Free =>
      context.become(empty)
      scribe.debug(s"Platform $name freed by ${sender.path.name}!")

    case GetNext => sender ! Next(this.next.get)

    case ArrivedAtPlatform =>
      scribe.debug(s"Train ${sender.path.name} arrived to platform $name")
      this.people.foreach { case(_, p) => p ! TrainInPlatform(sender)}

    case x: RequestEnterPlatform =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterPlatform(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterPlatform
      }

    case ExitPlatform =>
      people.remove(sender.path.name)

    case x: Any => scribe.error(s"Full platform does not understand $x from ${sender.path.name}")
  }

  def empty: Receive = {

    case Reserve =>
      scribe.debug(s"Platform $name reserved by ${sender.path.name}!")
      sender ! Reserved(self)
      context.become(full)

    case x: RequestEnterPlatform =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterPlatform(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterPlatform
      }

    case ExitPlatform =>
      people.remove(sender.path.name)

    case x: Any =>  scribe.warn(s"Empty Platform does not understand message $x")
  }
}
