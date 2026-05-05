import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import parser.{MetroParser, Path}


class SimClockSpec extends AnyFlatSpec with Matchers {

  // ── SimClock pure API ─────────────────────────────────────────────────────

  "SimClock" should "start paused" in {
    SimClock.reset()
    SimClock.isPaused shouldBe true
  }

  it should "resume and pause correctly" in {
    SimClock.reset()
    SimClock.resume()
    SimClock.isPaused shouldBe false
    SimClock.pause()
    SimClock.isPaused shouldBe true
  }

  it should "clamp speed factor to valid range" in {
    SimClock.setSpeed(0.0)
    SimClock.speedFactor shouldBe 0.1 +- 0.001

    SimClock.setSpeed(1_000_000.0)
    SimClock.speedFactor shouldBe 10_000.0 +- 0.001

    SimClock.setSpeed(10.0)
    SimClock.speedFactor shouldBe 10.0 +- 0.001
  }

  it should "reset simTimeMs to 06:00 (21600000 ms)" in {
    SimClock.reset()
    SimClock.simTimeMs shouldBe 6L * 3600L * 1000L
  }

  it should "queue events with scheduleAt" in {
    SimClock.reset()
    val before = SimClock.queueSize
    SimClock.scheduleAt(SimClock.simTimeMs + 1000L) { () => () }
    SimClock.queueSize shouldBe (before + 1)
    SimClock.reset() // cleans queue
  }

  it should "queue events with scheduleIn" in {
    SimClock.reset()
    SimClock.scheduleIn(5000L) { () => () }
    SimClock.queueSize shouldBe 1
    SimClock.reset()
  }
}


class PathDebuggerSpec extends AnyFlatSpec with Matchers {

  // Build the real graph once for all path tests
  private lazy val graph = {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    new Metro(sorted, 2000, 10).buildMetroGraph()
  }

  "PathDebugger.findPath" should "find a path between two valid stations" in {
    val result = PathDebugger.findPath(graph, "EMPALME", "BATAN")
    result should include ("\"found\":true")
    result should include ("EMPALME")
    result should include ("BATAN")
  }

  it should "return error for unknown origin" in {
    val result = PathDebugger.findPath(graph, "NOWHERE_XYZ", "BATAN")
    result should include ("\"found\":false")
    result should include ("Station not found")
  }

  it should "return error for unknown destination" in {
    val result = PathDebugger.findPath(graph, "EMPALME", "NOWHERE_XYZ")
    result should include ("\"found\":false")
    result should include ("Station not found")
  }

  it should "return error when origin and destination are the same" in {
    val result = PathDebugger.findPath(graph, "EMPALME", "EMPALME")
    result should include ("\"found\":false")
    result should include ("same node")
  }

  it should "include platform nodes in the result" in {
    val result = PathDebugger.findPath(graph, "EMPALME", "BATAN")
    result should include ("platform")
  }
}
