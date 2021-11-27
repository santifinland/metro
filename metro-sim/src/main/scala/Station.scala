// Metro. SDMT

import scala.concurrent.duration.DurationInt

import Main.actorSystem.{dispatcher, scheduler}
import akka.actor.{Actor, ActorRef}
import messages.Messages._

class Station(line: ActorRef, name: String) extends Actor {

  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()
  val MAX_CAPACITY = 3000

  override def preStart(): Unit = {
    scheduler.scheduleAtFixedRate(3.seconds, 1.seconds)(() => line ! PeopleInStation(self, people.size))
    scheduler.scheduleAtFixedRate(3.seconds, 60.seconds)(() => {
      people.foreach{ case (p, _) => scribe.info(s"$p still in ${self.path.name}") }
    })
  }

  def receive: Receive = {

    case RequestEnterStation =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(sender.path.name, sender)
        scribe.debug(s"""Station $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterStation
      } else {
        scribe.warn(s"""Station $name over capacity""")
        sender ! NotAcceptedEnterStation
      }

    case EnteredStationFromPlatform =>
      scribe.info(s"""Person ${sender.path.name} entered station $name from platform""")
      this.people.addOne(sender.path.name, sender)
      sender ! AcceptedEnterStation

    case ExitStation =>
      people.remove(sender.path.name)

    case x: Any =>  scribe.warn(s"Station does not understand message $x")
  }
}
