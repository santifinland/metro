// Metro. SDMT

import scala.concurrent.duration.DurationInt

import Main.actorSystem.{dispatcher, scheduler}
import akka.actor.Actor
import utils.WebSocket
import messages.Messages._


class UI extends Actor {

  val trains: scala.collection.mutable.Map[String, Int] = scala.collection.mutable.Map[String, Int]()

  override def preStart(): Unit = {
    scheduler.scheduleAtFixedRate(3.seconds, 1.seconds)(() => {
      val trainsPeople = computePeople(this.trains)
      WebSocket.sendText(s"""{"message": "peopleInTrains", "people": ${trainsPeople}}""")
    })
  }

  def receive: Receive = {

    case x: PeopleInLinePlatforms =>
      scribe.debug(s"""There are ${x.people} people in line ${sender.path.name} platforms""")
      WebSocket.sendText(
        s"""{"message": "peopleInLinePlatforms", "line": "${sender.path.name}", "people": ${x.people}}""")

    case x: PeopleInLineStations =>
      scribe.debug(s"""There are ${x.people} people in line ${sender.path.name} stations""")
      WebSocket.sendText(
        s"""{"message": "peopleInLineStations", "line": "${sender.path.name}", "people": ${x.people}}""")

    case x: PlatformOvercrowded =>
      scribe.debug(s"""There are ${x.people} people in platform ${sender.path.name}""")
      WebSocket.sendText(
        s"""{"message": "platformOvercrowded", "platform": "${x.actorRef.path.name}", "people": ${x.people}}""")

    case x: StationOvercrowded =>
      scribe.debug(s"""There are ${x.people} people in platform ${sender.path.name}""")
      WebSocket.sendText(
        s"""{"message": "stationOvercrowded", "station": "${x.actorRef.path.name}", "people": ${x.people}}""")

    case x: PeopleInTrain =>
      scribe.debug(s"""There are ${x.people} people in platform ${sender.path.name}""")
      trains(sender.path.name) = x.people

    case x: PeopleInMetro =>
      scribe.debug(s"""There are ${x.people} people in Metro""")
      WebSocket.sendText(
        s"""{"message": "peopleInMetro", "people": ${x.people}}""")

    case _ => scribe.warn("Message not understood")
  }

  def computePeople(recipient: scala.collection.mutable.Map[String, Int]): Int = {
    recipient.map { case (_, people: Int) => people }.sum
  }
}
