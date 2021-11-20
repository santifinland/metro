// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef}

import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._


class Line(ui: ActorRef) extends Actor {

  val stations: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map[String, Int]()

  def receive: Receive = {
    case _ =>
      scribe.info(s"""Recevied initial Line meessage""")
      scheduler.scheduleAtFixedRate(3.seconds, 3.seconds)( new Runnable {
        override def run(): Unit = ui ! PeopleInStation(computeLinePeople())
      })
      context.become(receivePeople)
  }

  def receivePeople: Receive = {
    case x: PeopleInStation => {
      //scribe.debug(s"""There are ${x.people} people in ${sender.path.name} station""")
      stations(sender.path.name) = x.people
    }
  }

  def computeLinePeople(): Int = {
    this.stations.map { case (_, people: Int) => people }.sum
  }
}
