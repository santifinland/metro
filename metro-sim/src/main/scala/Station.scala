// Metro. SDMT

import akka.actor.{Actor, ActorRef}
import messages.Messages.{AcceptedEnterStation, EnteredStationFromPlatform, ExitStation, NotAcceptedEnterStation, RequestEnterStation}


class Station(name: String) extends Actor {

  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 300

  def receive: Receive = {

    case RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(sender.path.name, sender)
        scribe.debug(s"""Station $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation
      } else {
        scribe.info(s"""Station $name over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case EnteredStationFromPlatform =>
      this.people.addOne(sender.path.name, sender)
      sender ! AcceptedEnterStation

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any =>  scribe.warn(s"Station does not understand message $x")
  }
}
