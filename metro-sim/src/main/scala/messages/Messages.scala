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
  case object TrainArrivedAtStation

  // Train -> Station messages
  case object ArrivedAtStation

  // Application -> Person messages
  case class EnterStation(actorRef: ActorRef)

  // Person -> Station messages
  case class RequestEnterStation(actorRef: ActorRef)

  case object ExitStation

  // Station -> Person messages
  case class AcceptedEnterStation(actorRef: ActorRef)

  case object NotAcceptedEnterStation

  case class TrainInStation(actorRef: ActorRef)

  // Person -> Train messages
  case class RequestEnterTrain(actorRef: ActorRef)

  case object ExitTrain

  // Train -> Person messages
  case class AcceptedEnterTrain(actorRef: ActorRef)

  case object NotAcceptedEnterTrain

  case class ArrivedAtStationToPeople(actorRef: ActorRef)

  // Station -> User interface messages
  case class PeopleInStation(people: Int)

}
