// Metro. SDMT
package messages

import akka.actor.ActorRef


object Messages {

  // Application debug message
  case object Debug

  // Application -> Simulator
  case class Simulate(limit: Option[Int])

  // Platform -> Train messages
  case class FullPlatform(actorRef: ActorRef)
  case class PlatformReserved(actorRef: ActorRef)

  // Train -> self Train messages
  case object TrainArrivedAtPlatform

  // Train -> Platform messages
  case object ArrivedAtPlatform
  case object LeavingPlatform
  case object GetNextPlatform
  case object ReservePlatform

  // Person -> Platform messages
  case object RequestEnterPlatform
  case object ExitPlatform
  case object EnteredPlatformFromTrain

  // Person -> Simulator messages
  case class ArrivedToDestination(actorRef: ActorRef)
  case class PeopleInMetro(people: Int)

  // Person -> Train messages
  case class RequestEnterTrain(actorRef: ActorRef)
  case object ExitTrain

  // Person -> Station messages
  case object RequestEnterStation
  case object EnteredStationFromPlatform
  case object ExitStation

  // Platform -> Person messages
  case class AcceptedEnterPlatform(actorRef: ActorRef)
  case object NotAcceptedEnterPlatform
  case class TrainInPlatform(actorRef: ActorRef)

  // Platform -> Line
  case class PeopleInPlatform(actorRef: ActorRef, people: Int)

  // Train -> Person messages
  case class AcceptedEnterTrain(actorRef: ActorRef)
  case object NotAcceptedEnterTrain
  case class ArrivedAtPlatformToPeople(actorRef: ActorRef)

  // Train -> User interface messages
  case class PeopleInTrain(people: Int)

  // Platform -> User interface messages
  case class PeopleInLinePlatforms(people: Int)
  case class PeopleInLineStations(people: Int)

  // Application -> Train messages
  case class Move(actorRef: ActorRef)

  // Platform -> Platform messages issued by the application when building the metro graph
  case class NextPlatform(actorRef: ActorRef)

  // Station -> Person
  case object AcceptedEnterStation
  case object NotAcceptedEnterStation

  // Station -> Line
  case class PeopleInStation(actorRef: ActorRef, people: Int)

  // Line -> User Interface
  case class PlatformOvercrowded(actorRef: ActorRef, people: Int)
  case class StationOvercrowded(actorRef: ActorRef, people: Int)
}
