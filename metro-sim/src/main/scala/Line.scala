// Metro. SDMT

import scala.concurrent.duration.DurationInt

import akka.actor.{Actor, ActorRef}

import Main.actorSystem.{dispatcher, scheduler}
import messages.Messages._


class Line(ui: ActorRef) extends Actor {

  val platforms: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map[String, Int]()
  val stations: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map[String, Int]()

  override def preStart(): Unit = {
    scheduler.scheduleAtFixedRate(3.seconds, 3.seconds)(() => {
      ui ! PeopleInLinePlatforms(computePeople(this.platforms))
      ui ! PeopleInLineStations(computePeople(this.stations))
    })
  }

  def receive: Receive = {

    case x: PeopleInPlatform =>
      if (x.people > 0) {
        scribe.debug(s"""There are ${x.people} people in ${sender.path.name}""")
        if (x.people > 100) {
          ui ! PlatformOvercrowded(sender, x.people)
        }
      }
      platforms(sender.path.name) = x.people

    case x: PeopleInStation =>
      if (x.people > 0) {
        scribe.debug(s"""There are ${x.people} people in ${sender.path.name}""")
        if (x.people > 1000) {
          ui ! StationOvercrowded(sender, x.people)
        }
      }
      stations(sender.path.name) = x.people
  }

  def computePeople(recipient: scala.collection.mutable.Map[String, Int]): Int = {
    recipient.map { case (_, people: Int) => people }.sum
  }
}
