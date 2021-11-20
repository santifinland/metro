// Metro. SDMT

import akka.actor.Actor
import messages.Messages._
import utils.WebSocket


class UI extends Actor {

  def receive: Receive = {

    case x: PeopleInStation =>
      WebSocket.sendText(
        s"""{"message": "peopleInStation", "line": "${sender.path.name}", "people": ${x.people}}""")

    case _ => scribe.warn("Message not understood")
  }
}
