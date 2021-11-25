// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef}

import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._


class Line(ui: ActorRef) extends Actor {

  val platforms: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map[String, Int]()

  override def preStart(): Unit = {
    scheduler.scheduleAtFixedRate(3.seconds, 3.seconds)(() => ui ! PeopleInLine(computeLinePeople()))
  }

  def receive: Receive = {

    case x: PeopleInPlatform =>
      if (x.people > 0) {
        scribe.info(s"""There are ${x.people} people in ${sender.path.name}""")
      }
      platforms(sender.path.name) = x.people
  }

  def computeLinePeople(): Int = {
    this.platforms.map { case (_, people: Int) => people }.sum
  }
}
