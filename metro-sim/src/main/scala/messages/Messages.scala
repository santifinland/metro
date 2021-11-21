// Metro. SDMT
package messages

import akka.actor.ActorRef


object Messages {

  case object Free

  case object Reserve

  case object GetNext

  case class Full(actorRef: ActorRef)

  case class Move(actorRef: ActorRef)

  case class Next(actorRef: ActorRef)

  case class Reserved(actorRef: ActorRef)

  // Train -> self Train messages
  case object TrainArrivedAtPlatform

  // Train -> Platform messages
  case object ArrivedAtPlatform

  // Application -> Person messages
  case class EnterPlatform(actorRef: ActorRef)

  // Person -> Platform messages
  case class RequestEnterPlatform(actorRef: ActorRef)

  case object ExitPlatform

  // Platform -> Person messages
  case class AcceptedEnterPlatform(actorRef: ActorRef)

  case object NotAcceptedEnterPlatform

  case class TrainInPlatform(actorRef: ActorRef)

  // Person -> Train messages
  case class RequestEnterTrain(actorRef: ActorRef)

  case object ExitTrain

  // Train -> Person messages
  case class AcceptedEnterTrain(actorRef: ActorRef)

  case object NotAcceptedEnterTrain

  case class ArrivedAtPlatformToPeople(actorRef: ActorRef)

  // Platform -> User interface messages
  case class PeopleInPlatform(people: Int)

}
