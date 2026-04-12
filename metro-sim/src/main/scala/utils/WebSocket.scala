package utils

import org.apache.pekko.NotUsed
import org.apache.pekko.http.scaladsl.model.ws.{Message, TextMessage}
import org.apache.pekko.stream.OverflowStrategy
import org.apache.pekko.stream.scaladsl.{Flow, Sink, Source, SourceQueueWithComplete}

object WebSocket {

  private var browserConnections: List[TextMessage => Unit] = List()

  // Snapshot of current simulation state, keyed so each logical value is stored once.
  // Sent in full to every new client that connects (page reload, reconnect, new tab).
  //   "train:<id>"                  → latest newTrain position for that train
  //   "peopleInTrains"              → aggregate people-in-trains count
  //   "peopleInMetro"               → aggregate
  //   "peopleInSimulation"          → aggregate
  //   "peopleInLinePlatforms:<id>"  → per-line platform count
  //   "peopleInLineStations:<id>"   → per-line station count
  private val snapshot = scala.collection.mutable.Map[String, String]()

  def listen(): Flow[Message, Message, NotUsed] = {
    val inbound: Sink[Message, Any] = Sink.ignore
    val outbound: Source[Message, SourceQueueWithComplete[Message]] =
      Source.queue[Message](4096, OverflowStrategy.fail)

    Flow.fromSinkAndSourceMat(inbound, outbound) { (_, outboundMat) =>
      val send: TextMessage => Unit = msg => { outboundMat.offer(msg); () }
      browserConnections ::= send
      // Replay current state to this specific new client
      snapshot.values.foreach(json => send(TextMessage.Strict(json)))
      NotUsed
    }
  }

  /** Send a train position event and update the snapshot. */
  def sendTrain(trainId: String, x: Double, y: Double, people: Int, capacity: Int, isNew: Boolean): Unit = {
    val liveType = if (isNew) "newTrain" else "moveTrain"
    val liveJson = s"""{"message": "$liveType", "train": "$trainId", "x": $x, "y": $y, "people": $people, "capacity": $capacity}"""
    // Snapshot always as newTrain so reconnecting clients (re)create the train
    snapshot(s"train:$trainId") =
      s"""{"message": "newTrain", "train": "$trainId", "x": $x, "y": $y, "people": $people, "capacity": $capacity}"""
    broadcast(liveJson)
  }

  /** Send a stat message and update the snapshot under the given key. */
  def sendStat(key: String, json: String): Unit = {
    snapshot(key) = json
    broadcast(json)
  }

  /** Broadcast without updating the snapshot (ephemeral alerts). */
  def sendText(text: String): Unit = broadcast(text)

  private def broadcast(json: String): Unit = {
    val msg = TextMessage.Strict(json)
    browserConnections.foreach(_(msg))
  }
}
