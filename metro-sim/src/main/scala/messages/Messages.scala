// Metro. SDMT
package messages

import akka.actor.ActorRef


object Messages {

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

  // Person -> Train messages
  case class RequestEnterTrain(actorRef: ActorRef)
  case object ExitTrain

  // Person -> Station messages
  case object RequestEnterStation

  // Platform -> Person messages
  case class AcceptedEnterPlatform(actorRef: ActorRef)
  case object NotAcceptedEnterPlatform
  case class TrainInPlatform(actorRef: ActorRef)

  // Train -> Person messages
  case class AcceptedEnterTrain(actorRef: ActorRef)
  case object NotAcceptedEnterTrain
  case class ArrivedAtPlatformToPeople(actorRef: ActorRef)

  // Platform -> User interface messages
  case class PeopleInPlatform(people: Int)

  // Application -> Train messages
  case class Move(actorRef: ActorRef)

  // Platform -> Platform messages issued by the application when building the metro graph
  case class NextPlatform(actorRef: ActorRef)

  // Station -> Person
  case object AcceptedEnterStation
  case object NotAcceptedEnterStation

}
