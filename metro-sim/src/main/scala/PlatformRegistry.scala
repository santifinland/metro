// Metro. SDMT
import org.apache.pekko.actor.typed.ActorRef
import messages.Messages._

object PlatformRegistry {

  private val platforms = scala.collection.mutable.Map.empty[String, ActorRef[PlatformMessage]]

  def register(name: String, ref: ActorRef[PlatformMessage]): Unit =
    platforms.synchronized { platforms(name) = ref }

  def sendByAnden(codigoanden: String, msg: PlatformMessage): Unit = {
    val ref = platforms.synchronized { platforms.get(Metro.PlatformPrefix + codigoanden) }
    ref.foreach(_ ! msg)
  }
}
