// Metro. SDMT

import java.text.Normalizer
import java.util.Calendar
import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._
import parser.Path


class Station(line: ActorRef, name: String) extends Actor {

  var next: Option[ActorRef] = None
  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 300

  def receive: Receive = {
    case x: Next =>
      this.next = Some(x.actorRef)
      scribe.debug(s"Setting station ${self.path.name} to empty mode")
      context.become(empty)
      scheduler.scheduleAtFixedRate(3.seconds, 3.seconds)( new Runnable {
        override def run(): Unit = line ! PeopleInStation(people.size)
      })
    case _ => scribe.warn("Next station not set yet")
  }

  def full: Receive = {

    case Reserve =>
      scribe.debug(s"${Calendar.getInstance().getTime} Station ${self.path.name} is not Free!")
      sender ! Full(self)

    case Free =>
      context.become(empty)
      scribe.debug(s"${Calendar.getInstance().getTime} Station ${self.path.name} freed by ${sender.path.name}!")

    case GetNext => sender ! Next(this.next.get)

    case ArrivedAtStation =>
      scribe.debug(s"${Calendar.getInstance().getTime} Train ${sender.path.name} arrived to ${name}")

      this.people.foreach { case(_, p) => p ! TrainInStation(sender)}

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Station ${self.path.name} with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation(self)
      } else {
        scribe.warn(s"""Station ${self.path.name} over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any => scribe.error(s"Full Station does not understand $x from ${sender.path.name}")
  }

  def empty: Receive = {

    case Reserve =>
      scribe.debug(s"${Calendar.getInstance().getTime} Station ${self.path.name} reserved by ${sender.path.name}!")
      sender ! Reserved(self)
      context.become(full)

    case x: RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Station ${self.path.name} with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation(self)
      } else {
        scribe.warn(s"""Station ${self.path.name} over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any =>  scribe.warn(s"Emtpy Station does not understand message $x")
  }
}

object Station {

  // Build stations and its connections: the metro network
  def buildStation(actorSystem: ActorSystem, sortedLines: Map[String, Seq[Path]],
                   L: ActorRef): Iterable[(String, Seq[ActorRef])] = {
    for {
      (line: String, lines: Seq[Path]) <- sortedLines
      if line == "10a" || line == "11"
      actors: Seq[ActorRef] = lines.map { l =>
        val normalized = Normalizer.normalize(l.features.denominacion, Normalizer.Form.NFD)
        val kk = normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
        actorSystem.actorOf(Props(classOf[Station], L, l.features.denominacion), l.features.codigoanden.toString)
      }
      _ = Path.sendNextStation(actors)
    } yield (line, actors)
  }

}
