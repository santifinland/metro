// Metro. SDMT

import scala.concurrent.duration.DurationInt

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors

import messages.Messages._


object Station {

  def apply(line: ActorRef[LineMessage], name: String): Behavior[StationMessage] =
    Behaviors.setup { context =>
      Behaviors.withTimers { timers =>
        timers.startTimerWithFixedDelay("stats-tick", StationStatsTick, 3.seconds, 1.second)

        val people: scala.collection.mutable.Map[String, ActorRef[PersonMessage]] =
          scala.collection.mutable.Map.empty

        Behaviors.receiveMessage {

          case StationStatsTick =>
            line ! PeopleInStation(name, people.size)
            Behaviors.same

          case RequestEnterStation(person) =>
            if (people.size < 3000) {
              people(person.path.name) = person
              scribe.debug(s"Station $name with ${people.size} people after adding")
              person ! AcceptedEnterStation(context.self)
            } else {
              scribe.warn(s"Station $name over capacity")
              person ! NotAcceptedEnterStation
            }
            Behaviors.same

          case EnteredStationFromPlatform(person) =>
            scribe.info(s"Person ${person.path.name} entered station $name from platform")
            people(person.path.name) = person
            person ! AcceptedEnterStation(context.self)
            Behaviors.same

          case ExitStation(personId) =>
            people.remove(personId)
            Behaviors.same
        }
      }
    }
}
