// Metro. SDMT

import akka.actor.{Actor, ActorRef}


class Station(name: String) extends Actor {

  val people: scala.collection.mutable.Map[String, ActorRef] = scala.collection.mutable.Map[String, ActorRef]()

  def receive: Receive = {

    case x: Any =>  scribe.warn(s"Station does not understand message $x")
  }
}


