package utils

import org.apache.pekko.NotUsed
import org.apache.pekko.http.scaladsl.model.ws.{Message, TextMessage}
import org.apache.pekko.stream.OverflowStrategy
import org.apache.pekko.stream.QueueOfferResult
import org.apache.pekko.stream.scaladsl.{Flow, Sink, Source, SourceQueueWithComplete}

object WebSocket {

  // Snapshot of current simulation state, keyed so each logical value is stored once.
  // Sent in full to every new client that connects (page reload, reconnect, new tab).
  private val snapshot = scala.collection.mutable.Map[String, String]()

  // Active connections: (id, queue). Cleaned up on disconnect via watchCompletion.
  private var connections: List[(String, SourceQueueWithComplete[Message])] = List()

  // Command handler set by Main — called for every message received from the browser.
  private var commandHandler: String => Unit = _ => ()

  def setCommandHandler(f: String => Unit): Unit = { commandHandler = f }

  def listen(): Flow[Message, Message, NotUsed] = {
    val connId = java.util.UUID.randomUUID.toString

    // Fix 2: parse incoming messages instead of dropping them
    val inbound: Sink[Message, Any] = Sink.foreach {
      case TextMessage.Strict(text) => commandHandler(text)
      case _                        => ()
    }

    val outbound: Source[Message, SourceQueueWithComplete[Message]] =
      Source.queue[Message](4096, OverflowStrategy.dropHead)

    Flow.fromSinkAndSourceMat(inbound, outbound) { (_, queue) =>
      // Fix 3: remove connection from list when client disconnects
      queue.watchCompletion().foreach { _ =>
        WebSocket.synchronized {
          connections = connections.filterNot(_._1 == connId)
        }
      }(scala.concurrent.ExecutionContext.global)

      WebSocket.synchronized {
        connections = (connId, queue) :: connections
      }

      // Replay current state snapshot to this new client
      snapshot.values.foreach(json => queue.offer(TextMessage.Strict(json)))
      NotUsed
    }
  }

  /** Remove all train entries from the snapshot and notify all clients to reset. */
  def resetSnapshot(): Unit = {
    WebSocket.synchronized {
      snapshot.keys.filter(_.startsWith("train:")).toList.foreach(snapshot.remove)
    }
    broadcast("""{"message": "reset"}""")
  }

  /** Send a train position event and update the snapshot. */
  def sendTrain(trainId: String, x: Double, y: Double, people: Int, capacity: Int, isNew: Boolean): Unit = {
    val liveType = if (isNew) "newTrain" else "moveTrain"
    val liveJson = s"""{"message": "$liveType", "train": "$trainId", "x": $x, "y": $y, "people": $people, "capacity": $capacity}"""
    // Snapshot always as newTrain so reconnecting clients (re)create the train
    WebSocket.synchronized {
      snapshot(s"train:$trainId") =
        s"""{"message": "newTrain", "train": "$trainId", "x": $x, "y": $y, "people": $people, "capacity": $capacity}"""
    }
    broadcast(liveJson)
  }

  /** Send a stat message and update the snapshot under the given key. */
  def sendStat(key: String, json: String): Unit = {
    WebSocket.synchronized { snapshot(key) = json }
    broadcast(json)
  }

  /** Broadcast without updating the snapshot (ephemeral alerts). */
  def sendText(text: String): Unit = broadcast(text)

  private def broadcast(json: String): Unit = {
    val msg = TextMessage.Strict(json)
    WebSocket.synchronized { connections }.foreach { case (_, queue) =>
      queue.offer(msg)
    }
  }
}
