// Metro. SDMT

import akka.actor.Actor
import messages.Messages._
import utils.WebSocket


class UI extends Actor {

  def receive: Receive = {

    case x: PeopleInPlatform =>
      WebSocket.sendText(
        s"""{"message": "peopleInPlatform", "line": "${sender.path.name}", "people": ${x.people}}""")

    case _ => scribe.warn("Message not understood")
  }
}
