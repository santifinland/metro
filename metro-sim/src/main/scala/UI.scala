// Metro. SDMT

import akka.actor.Actor

import Messages._


class UI extends Actor {

  def receive: Receive = {

    case x: PeopleInStation =>
      WebSocket.sendText(
        s"""{"message": "peopleInStation", "line": "${sender.path.name}", "people": ${x.people}}""")

    case _ => scribe.debug("Message not understood")
  }
}
