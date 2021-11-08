// Metro. SDMT

import akka.actor.{ActorRef}


object Messages {

  case object Free
  case object Reserve
  case object GetNext
  case class Full(actorRef: ActorRef)
  case class Move(actorRef: ActorRef)
  case class Next(actorRef: ActorRef)
  case class Reserved(actorRef: ActorRef)
}