// Metro. SDMT

import scala.concurrent.duration.DurationInt
import scala.util.{Failure, Random, Success}

import org.apache.pekko.actor.typed.{ActorRef, ActorSystem, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.actor.typed.scaladsl.adapter._
import org.apache.pekko.http.scaladsl.Http
import org.apache.pekko.http.scaladsl.server.Directives.{handleWebSocketMessages, path}
import org.apache.pekko.http.scaladsl.server.Route

import parser.{Entrance, EntranceParser, MetroParser, Path, StationIds, StationParser}
import pureconfig._
import pureconfig.generic.auto._
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import scribe.Level
import messages.Messages._
import utils.WebSocket


object Main {

  def main(args: Array[String]): Unit = {

    // Read configuration
    val metroConf = ConfigSource.default.load[MetroConf].toOption.get
    scribe.Logger.root
      .clearHandlers()
      .clearModifiers()
      .withHandler(minimumLevel = Some(Level.Info))
      .replace()
    val speedFactor: Double = metroConf.timeMultiplier.toDouble
    scribe.info(s"Metro starting. Sim speed: ${speedFactor}× real time")
    SimClock.setSpeed(speedFactor)
    SimClock.start()

    // Get daily entrance data
    val entrance: String = scala.io.Source.fromFile("data/entrance.json").mkString
    val entrances: Seq[Entrance] = new EntranceParser().parseEntrances(entrance)

    // Get station IDs
    val stationId: String = scala.io.Source.fromFile("data/stations.json").mkString
    val stationIds: Seq[StationIds] = new StationParser().parseStations(stationId)

    // Build station → entrance map
    val stationIdsEntrance: Map[StationIds, Option[Entrance]] = stationIds
      .map(s => s -> entrances.find(e => e.id == Integer.valueOf(s.secondaryId).toString))
      .toMap
      .filter { case (_, v) => v.isDefined }

    // Metro network
    val metro: String = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths: Seq[Path] = new MetroParser(metro).parseMetro(metro)

    val sortedLinePaths: Map[String, Seq[Path]] = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }

    val WeightStationStation = 2000
    val WeightStationPlatform = 10
    val metroGraph: Graph[MetroNode, WDiEdge] =
      new Metro(sortedLinePaths, WeightStationStation, WeightStationPlatform).buildMetroGraph()

    // Launch typed ActorSystem with a Guardian behavior
    val system: ActorSystem[Guardian.Command] = ActorSystem(
      Guardian(metroConf, metroGraph, sortedLinePaths, paths, stationIdsEntrance),
      "metro-system"
    )

    // Start WebSocket HTTP server using classic adapter
    implicit val classicSystem: org.apache.pekko.actor.ActorSystem = system.toClassic
    import classicSystem.dispatcher
    def broadcastPaused(): Unit = {
      val p = SimClock.isPaused
      WebSocket.sendStat("simPaused", s"""{"message": "simPaused", "paused": $p}""")
    }

    // Register command handler for messages from the browser
    WebSocket.setCommandHandler { text =>
      if (text.contains("\"reset\"")) {
        SimClock.reset()
        WebSocket.resetSnapshot()
        broadcastPaused()
      } else if (text.contains("\"setSpeed\"")) {
        val factor = text.split("\"factor\"\\s*:\\s*").drop(1).headOption
          .flatMap(_.trim.takeWhile(c => c.isDigit || c == '.').toDoubleOption)
          .getOrElse(SimClock.speedFactor)
        SimClock.setSpeed(factor)
        val tm = 1.0 / SimClock.speedFactor
        WebSocket.sendStat("timeMultiplier", s"""{"message": "timeMultiplier", "multiplier": $tm}""")
      } else if (text.contains("\"pause\"")) {
        SimClock.pause()
        broadcastPaused()
      } else if (text.contains("\"resume\"")) {
        SimClock.resume()
        broadcastPaused()
      }
    }

    val route: Route = path("ws") { handleWebSocketMessages(WebSocket.listen()) }
    Http().newServerAt("0.0.0.0", 8081).bind(route).onComplete {
      case Success(binding) =>
        println(s"Listening at ${binding.localAddress.getHostString}:${binding.localAddress.getPort}")
        Thread.sleep(4000)
        val tm = 1.0 / SimClock.speedFactor
        WebSocket.sendStat("timeMultiplier", s"""{"message": "timeMultiplier", "multiplier": $tm}""")
      case Failure(ex) => throw ex
    }
  }
}


object Guardian {

  sealed trait Command

  def apply(
    metroConf: MetroConf,
    metroGraph: Graph[MetroNode, WDiEdge],
    sortedLinePaths: Map[String, Seq[Path]],
    allPaths: Seq[Path],
    stationIdsEntrance: Map[StationIds, Option[Entrance]]
  ): Behavior[Command] =
    Behaviors.setup[Command] { context =>

      // UI actor
      val ui = context.spawn(UI(), "ui")

      // Line actors
      val lineActors: Map[String, ActorRef[LineMessage]] = sortedLinePaths.keys.map { l =>
        l -> context.spawn(Line(ui, "L" + l), "L" + l)
      }.toMap

      // Station actors (one per unique station name in graph)
      val stationActors: Map[String, ActorRef[StationMessage]] = metroGraph
        .nodes
        .filter(x => x.value.name.startsWith(Metro.StationPrefix))
        .map { x =>
          val lineId = x.value.lines.headOption.getOrElse("")
          val lineActor = lineActors.getOrElse(lineId.stripPrefix("L"), lineActors.values.head)
          x.value.name -> context.spawn(Station(lineActor, x.value.name), x.value.name)
        }
        .toMap

      // Platform actors per line
      val platformActors: Map[String, Map[String, ActorRef[PlatformMessage]]] =
        (for {
          (lineKey, lineActor) <- lineActors
        } yield {
          val linePlatforms: Map[String, ActorRef[PlatformMessage]] = metroGraph
            .nodes
            .filter(x => x.value.lines.contains("L" + lineKey))
            .filter(x => x.value.name.startsWith(Metro.PlatformPrefix))
            .map { x =>
              x.value.name -> context.spawn(Platform(lineActor, x.value.name), x.value.name)
            }
            .toMap
          lineKey -> linePlatforms
        }).toMap

      val allPlatformActors: Map[String, ActorRef[PlatformMessage]] =
        platformActors.values.reduce(_ ++ _)

      // Wire platform → next platform
      metroGraph
        .nodes
        .filter(x => x.value.name.startsWith(Metro.PlatformPrefix))
        .foreach { x =>
          val current = allPlatformActors(x.value.name)
          x.diSuccessors
            .filter(s => s.value.name.startsWith(Metro.PlatformPrefix))
            .foreach { z =>
              val next = allPlatformActors(z.value.name)
              current ! SetNextPlatform(next)
            }
        }

      // Build trains
      val random = new Random
      val percentageOfStationsWithTrains = 80
      platformActors.foreach { case (lineKey, linePlatforms) =>
        val platforms = linePlatforms.values.toSeq
        val trainCount = (percentageOfStationsWithTrains * platforms.length / 100) + 1
        for (_ <- 1 to trainCount) {
          val start = platforms(random.nextInt(platforms.size))
          val uuid = java.util.UUID.randomUUID.toString
          val train = context.spawn(Train(ui, allPaths), uuid)
          train ! Move(start)
        }
      }

      // Simulator
      val allStationAndPlatformActors: List[ActorRef[_]] =
        stationActors.values.toList ++ allPlatformActors.values.toList

      context.spawn(
        Simulator(ui, allStationAndPlatformActors, metroGraph, stationIdsEntrance),
        "simulator"
      )

      Behaviors.empty[Command]
    }
}
