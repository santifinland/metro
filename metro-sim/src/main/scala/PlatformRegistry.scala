// Metro. SDMT
import org.apache.pekko.actor.typed.ActorRef
import messages.Messages._

object PlatformRegistry {

  private val platforms = scala.collection.mutable.Map.empty[String, ActorRef[PlatformMessage]]

  def register(name: String, ref: ActorRef[PlatformMessage]): Unit =
    platforms.synchronized { platforms(name) = ref }

  def sendByAnden(codigoanden: String, msg: PlatformMessage): Unit = {
    val ref = platforms.synchronized {
      platforms.find { case (k, _) => k.split("_").last == codigoanden }.map(_._2)
    }
    ref.foreach(_ ! msg)
  }
}
