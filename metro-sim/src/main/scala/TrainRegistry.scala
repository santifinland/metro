// Metro. SDMT
import org.apache.pekko.actor.typed.ActorRef
import messages.Messages._

object TrainRegistry {

  private val trains = scala.collection.mutable.Map.empty[String, ActorRef[TrainMessage]]

  def register(name: String, ref: ActorRef[TrainMessage]): Unit =
    trains.synchronized { trains(name) = ref }

  def unregister(name: String): Unit =
    trains.synchronized { trains.remove(name) }

  def send(trainId: String, msg: TrainMessage): Unit =
    trains.synchronized { trains.get(trainId) }.foreach(_ ! msg)
}
