// Metro. SDMT

import scala.concurrent.duration.DurationInt

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Platform {

  private val MAX_CAPACITY = 500

  def apply(line: ActorRef[LineMessage], ui: ActorRef[UIMessage], name: String): Behavior[PlatformMessage] =
    Behaviors.setup { _ => waitingForNext(line, ui, name) }

  private def waitingForNext(line: ActorRef[LineMessage], ui: ActorRef[UIMessage], name: String): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {
      case SetNextPlatform(next) =>
        Behaviors.setup { context =>
          Behaviors.withTimers { timers =>
            timers.startTimerWithFixedDelay("stats-tick", PlatformStatsTick, 3.seconds, 3.seconds)
            val people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)] =
              scala.collection.mutable.Map.empty
            val destinations: scala.collection.mutable.Map[String, String] =
              scala.collection.mutable.Map.empty
            val anderId = name.split("_").last
            PlatformRegistry.register(name, context.self)
            empty(context.self, line, ui, name, anderId, next, people, destinations)
          }
        }
      case _ =>
        scribe.warn(s"Platform $name: next not set yet")
        Behaviors.same
    }

  private def empty(
    self: ActorRef[PlatformMessage],
    line: ActorRef[LineMessage],
    ui: ActorRef[UIMessage],
    name: String,
    anderId: String,
    next: ActorRef[PlatformMessage],
    people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)],
    destinations: scala.collection.mutable.Map[String, String],
  ): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {

      case PlatformStatsTick =>
        line ! PeopleInPlatform(name, people.size)
        Behaviors.same

      case RequestEnterPlatform(person, destination) =>
        if (people.size < MAX_CAPACITY) {
          people(person.path.name) = (person, true)
          destinations(person.path.name) = destination
          person ! AcceptedEnterPlatform(self)
        } else {
          scribe.warn(s"Platform $name over capacity")
          person ! NotAcceptedEnterPlatform
        }
        Behaviors.same

      case ReservePlatform(train) =>
        train ! PlatformReserved(self)
        full(self, line, ui, name, anderId, next, people, destinations)

      case ExitPlatform(personId) =>
        people.remove(personId)
        destinations.remove(personId)
        Behaviors.same

      case EnteredPlatformFromTrain(person, destination) =>
        people(person.path.name) = (person, false)
        destinations(person.path.name) = destination
        Behaviors.same

      case RequestPlatformPersonList =>
        val personList = people.keys.map(id => (id, destinations.getOrElse(id, ""))).toList
        ui ! PersonsInPlatform(anderId, personList)
        Behaviors.same

      case ResetPlatform =>
        people.clear()
        destinations.clear()
        empty(self, line, ui, name, anderId, next, people, destinations)

      case _ =>
        scribe.warn(s"Empty platform $name received unexpected message")
        Behaviors.same
    }

  private def full(
    self: ActorRef[PlatformMessage],
    line: ActorRef[LineMessage],
    ui: ActorRef[UIMessage],
    name: String,
    anderId: String,
    next: ActorRef[PlatformMessage],
    people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)],
    destinations: scala.collection.mutable.Map[String, String],
  ): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {

      case PlatformStatsTick =>
        line ! PeopleInPlatform(name, people.size)
        Behaviors.same

      case RequestEnterPlatform(person, destination) =>
        if (people.size < MAX_CAPACITY) {
          people(person.path.name) = (person, true)
          destinations(person.path.name) = destination
          person ! AcceptedEnterPlatform(self)
        } else {
          scribe.warn(s"Platform $name over capacity")
          person ! NotAcceptedEnterPlatform
        }
        Behaviors.same

      case ReservePlatform(train) =>
        train ! FullPlatform(self)
        Behaviors.same

      case LeavingPlatform =>
        empty(self, line, ui, name, anderId, next, people, destinations)

      case GetNextPlatform(train) =>
        train ! NextPlatformForTrain(next)
        Behaviors.same

      case ArrivedAtPlatform(train) =>
        people.foreach { case (_, (p, waiting)) => if (waiting) p ! TrainInPlatform(train) }
        Behaviors.same

      case ExitPlatform(personId) =>
        people.remove(personId)
        destinations.remove(personId)
        Behaviors.same

      case EnteredPlatformFromTrain(person, destination) =>
        people(person.path.name) = (person, false)
        destinations(person.path.name) = destination
        Behaviors.same

      case RequestPlatformPersonList =>
        val personList = people.keys.map(id => (id, destinations.getOrElse(id, ""))).toList
        ui ! PersonsInPlatform(anderId, personList)
        Behaviors.same

      case ResetPlatform =>
        people.clear()
        destinations.clear()
        empty(self, line, ui, name, anderId, next, people, destinations)

      case _ =>
        scribe.error(s"Full platform $name received unexpected message")
        Behaviors.same
    }
}
