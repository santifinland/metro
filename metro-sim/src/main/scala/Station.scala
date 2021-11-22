// Metro. SDMT

import akka.actor.{Actor, ActorRef}
import messages.Messages.{AcceptedEnterPlatform, NotAcceptedEnterPlatform, RequestEnterPlatform}


class Station(name: String) extends Actor {

  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()

  val MAX_CAPACITY = 300

  def receive: Receive = {

    case x: RequestEnterPlatform =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(x.actorRef.path.name, x.actorRef)
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterPlatform(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterPlatform
      }

    case x: Any =>  scribe.warn(s"Station does not understand message $x")
  }
}


