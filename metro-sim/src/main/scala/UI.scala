// Metro. SDMT

import akka.actor.Actor
import utils.WebSocket

import messages.Messages._


class UI extends Actor {

  def receive: Receive = {

    case x: PeopleInLine =>

      if (x.people > 0) {
        scribe.debug(s"""There are ${x.people} people in line ${sender.path.name}""")
      }
      WebSocket.sendText(
        s"""{"message": "peopleInLine", "line": "${sender.path.name}", "people": ${x.people}}""")

    case x: PeopleInPlatform =>
      scribe.debug(s"""There are ${x.people} people in platform ${sender.path.name}""")
      WebSocket.sendText(
        s"""{"message": "peopleInPlatform", "platform": "${x.actorRef.path.name}", "people": ${x.people}}""")

    case x: PeopleInMetro =>
      scribe.debug(s"""There are ${x.people} people in Metro""")
      WebSocket.sendText(
        s"""{"message": "peopleInMetro", "people": ${x.people}}""")

    case _ => scribe.warn("Message not understood")
  }
}
