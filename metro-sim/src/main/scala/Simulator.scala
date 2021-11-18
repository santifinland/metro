// Metro. SDMT

import scala.collection.immutable.SortedMap
import scala.util.Random

import akka.actor.{ActorRef, ActorSystem, Props}

import Messages.EnterStation


class Simulator(actorSystem: ActorSystem, stationActors: Map[String, Seq[ActorRef]]) {

  val random = new Random

  def simulate(): Unit = {
    val daily_journeys = 50000
    //val people: Int = (HourDistribution.value(0.4) * daily_journeys * 0.2 / (2 * 24 * 360)).toInt
    val people: Int = 2
    stationActors.foreach { case (_, actors) => actors.foreach { x =>
      val start = x
      val actorsLength: Int = actors.size
      Range(0, people).foreach { _ =>
        val destination = actors(random.nextInt(actorsLength))
        scribe.debug(s"""Person going to : ${destination.path.name}""")
        val uuid = java.util.UUID.randomUUID.toString
        val person = actorSystem.actorOf(Props(classOf[Person], destination), uuid)
        person ! EnterStation(start)
      }
    }
    }
  }
}

object Simulator {

  val HourDistribution = new Distribution(SortedMap[Double, Int](
    0.208 -> 1,
    0.25 -> 2,
    0.291 -> 6,
    0.333 -> 11,
    0.375 -> 7,
    0.416 -> 5,
    0.458 -> 6,
    0.5 -> 6,
    0.541 -> 6,
    0.583 -> 8,
    0.625 -> 6,
    0.625 -> 7,
    0.666 -> 8,
    0.708 -> 8,
    0.750 -> 7,
    0.791 -> 5,
    0.833 -> 3,
    0.875 -> 2,
    0.916 -> 1,
    0.958 -> 1,
    1.0 -> 1,
  ))
}
