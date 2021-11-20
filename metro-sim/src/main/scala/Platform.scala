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
      scribe.debug(s"Setting platform ${self.path.name} to empty mode")
      context.become(empty)
      scheduler.scheduleAtFixedRate(3.seconds, 10.seconds)( new Runnable {
        override def run(): Unit = line ! PeopleInStation(people.size)
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

    case ArrivedAtStation =>
      scribe.debug(s"Train ${sender.path.name} arrived to platform $name")
      this.people.foreach { case(_, p) => p ! TrainInStation(sender)}

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any => scribe.error(s"Full platform does not understand $x from ${sender.path.name}")
  }

  def empty: Receive = {

    case Reserve =>
      scribe.debug(s"Platform $name reserved by ${sender.path.name}!")
      sender ! Reserved(self)
      context.become(full)

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Station $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation(self)
      } else {
        scribe.warn(s"""Station $name over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any =>  scribe.warn(s"Empty Platform does not understand message $x")
  }
}

object Platform {

  // Build platform and its connections to Stations and next Platform in the same line
  def buildPlatformActors(actorSystem: ActorSystem, sortedLinePaths: Map[String, Seq[Path]],
                          L: ActorRef): Iterable[(String, Seq[ActorRef])] = {
    for {
      (line: String, paths: Seq[Path]) <- sortedLinePaths
      actors: Seq[ActorRef] = paths.map { l =>
        val platformName = l.features.denominacion + " " + l.features.codigoanden
        actorSystem.actorOf(Props(classOf[Platform], L, platformName), l.features.codigoanden.toString)
      }
      _ = Path.sendNextStation(actors)
    } yield (line, actors)
  }
}
