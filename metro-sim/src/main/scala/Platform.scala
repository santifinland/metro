// Metro. SDMT

import scala.concurrent.duration.DurationInt

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Platform {

  private val MAX_CAPACITY = 500

  def apply(line: ActorRef[LineMessage], name: String): Behavior[PlatformMessage] =
    Behaviors.setup { _ => waitingForNext(line, name) }

  private def waitingForNext(line: ActorRef[LineMessage], name: String): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {
      case SetNextPlatform(next) =>
        scribe.debug(s"Setting platform $name to empty mode. Next: ${next.path.name}")
        Behaviors.setup { context =>
          Behaviors.withTimers { timers =>
            timers.startTimerWithFixedDelay("stats-tick", PlatformStatsTick, 3.seconds, 3.seconds)
            val people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)] =
              scala.collection.mutable.Map.empty
            empty(context.self, line, name, next, people)
          }
        }
      case _ =>
        scribe.warn(s"Platform $name: next not set yet")
        Behaviors.same
    }

  private def empty(
    self: ActorRef[PlatformMessage],
    line: ActorRef[LineMessage],
    name: String,
    next: ActorRef[PlatformMessage],
    people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)]
  ): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {

      case PlatformStatsTick =>
        line ! PeopleInPlatform(name, people.size)
        Behaviors.same

      case RequestEnterPlatform(person) =>
        if (people.size < MAX_CAPACITY) {
          people(person.path.name) = (person, true)
          scribe.debug(s"Platform $name with ${people.size} people")
          person ! AcceptedEnterPlatform(self)
        } else {
          scribe.warn(s"Platform $name over capacity")
          person ! NotAcceptedEnterPlatform
        }
        Behaviors.same

      case ReservePlatform(train) =>
        scribe.debug(s"Platform $name reserved by ${train.path.name}!")
        train ! PlatformReserved(self)
        full(self, line, name, next, people)

      case ExitPlatform(personId) =>
        people.remove(personId)
        Behaviors.same

      case EnteredPlatformFromTrain(person) =>
        people(person.path.name) = (person, false)
        Behaviors.same

      case ResetPlatform =>
        people.clear()
        empty(self, line, name, next, people)

      case _ =>
        scribe.warn(s"Empty platform $name received unexpected message")
        Behaviors.same
    }

  private def full(
    self: ActorRef[PlatformMessage],
    line: ActorRef[LineMessage],
    name: String,
    next: ActorRef[PlatformMessage],
    people: scala.collection.mutable.Map[String, (ActorRef[PersonMessage], Boolean)]
  ): Behavior[PlatformMessage] =
    Behaviors.receiveMessage {

      case PlatformStatsTick =>
        line ! PeopleInPlatform(name, people.size)
        Behaviors.same

      case RequestEnterPlatform(person) =>
        if (people.size < MAX_CAPACITY) {
          people(person.path.name) = (person, true)
          scribe.debug(s"Platform $name with ${people.size} people")
          person ! AcceptedEnterPlatform(self)
        } else {
          scribe.warn(s"Platform $name over capacity")
          person ! NotAcceptedEnterPlatform
        }
        Behaviors.same

      case ReservePlatform(train) =>
        scribe.debug(s"Platform $name is not free!")
        train ! FullPlatform(self)
        Behaviors.same

      case LeavingPlatform =>
        scribe.debug(s"Platform $name freed!")
        empty(self, line, name, next, people)

      case GetNextPlatform(train) =>
        train ! NextPlatformForTrain(next)
        Behaviors.same

      case ArrivedAtPlatform(train) =>
        scribe.debug(s"Train ${train.path.name} arrived to platform $name")
        people.foreach { case (_, (p, waiting)) => if (waiting) p ! TrainInPlatform(train) }
        Behaviors.same

      case ExitPlatform(personId) =>
        people.remove(personId)
        Behaviors.same

      case EnteredPlatformFromTrain(person) =>
        people(person.path.name) = (person, false)
        Behaviors.same

      case ResetPlatform =>
        people.clear()
        empty(self, line, name, next, people)

      case _ =>
        scribe.error(s"Full platform $name received unexpected message")
        Behaviors.same
    }
}
