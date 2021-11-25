// Metro. SDMT

import akka.actor.Actor
import messages.Messages._
import utils.WebSocket


class UI extends Actor {

  def receive: Receive = {

    case x: PeopleInLine =>
      if (x.people > 0) {
        scribe.debug(s"""There are ${x.people} people in line ${sender.path.name}""")
      }
      WebSocket.sendText(
        s"""{"message": "peopleInLine", "line": "${sender.path.name}", "people": ${x.people}}""")

    case _ => scribe.warn("Message not understood")
  }
}
