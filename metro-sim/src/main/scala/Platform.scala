// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef}

import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._


class Platform(line: ActorRef, name: String) extends Actor {

  val people: scala.collection.mutable.Map[String, (ActorRef, Boolean)] =
    scala.collection.mutable.Map[String, (ActorRef, Boolean)]()
  var next: Option[ActorRef] = None
  val MAX_CAPACITY = 500

  def receive: Receive = {

    case x: NextPlatform =>
      this.next = Some(x.actorRef)
      scribe.debug(s"Setting platform ${self.path.name} to empty mode. Next actor ${x.actorRef.path.name}")
      context.become(empty)
      scheduler.scheduleAtFixedRate(3.seconds, 10.seconds)(() => line ! PeopleInPlatform(people.size))
    case _ => scribe.warn("Next platform not set yet")
  }

  def full: Receive = {

    case RequestEnterPlatform =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(sender.path.name, (sender, true))
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterPlatform(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterPlatform
      }

    case ReservePlatform =>
      scribe.debug(s"Platform $name is not Free!")
      sender ! FullPlatform(self)

    case LeavingPlatform =>
      context.become(empty)
      scribe.debug(s"Platform $name freed by ${sender.path.name}!")

    case GetNextPlatform => sender ! NextPlatform(this.next.get)

    case ArrivedAtPlatform =>
      scribe.debug(s"Train ${sender.path.name} arrived to platform $name")
      this.people.foreach { case(_, (p, waiting)) => if (waiting) p ! TrainInPlatform(sender) }

    case ExitPlatform =>
      people.remove(sender.path.name)

    case EnteredPlatformFromTrain =>
      this.people.addOne(sender.path.name, (sender, false))

    case x: Any => scribe.error(s"Full platform does not understand $x from ${sender.path.name}")
  }

  def empty: Receive = {

    case RequestEnterPlatform =>
      if (people.size < MAX_CAPACITY) {
        this.people.addOne(sender.path.name, (sender, true))
        scribe.debug(s"""Platform $name with ${this.people.size} people after adding""")
        sender ! AcceptedEnterPlatform(self)
      } else {
        scribe.warn(s"""Platform $name over capacity""")
        sender ! NotAcceptedEnterPlatform
      }

    case ReservePlatform =>
      scribe.debug(s"Platform $name reserved by ${sender.path.name}!")
      sender ! PlatformReserved(self)
      context.become(full)

    case ExitPlatform =>
      people.remove(sender.path.name)

    case EnteredPlatformFromTrain =>
      this.people.addOne(sender.path.name, (sender, false))

    case x: Any =>  scribe.warn(s"Empty Platform does not understand message $x")
  }
}
