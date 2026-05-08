import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import parser.{EntranceParser, MetroParser, Path, StationParser}
import utils.Position


class MetroSpec extends AnyFlatSpec with Matchers {

  // ── Metro.stationId ──────────────────────────────────────────────────────

  "Metro.stationId" should "add Station_ prefix" in {
    Metro.stationId("1") should startWith(Metro.StationPrefix)
  }

  it should "be exactly Station_ + code" in {
    Metro.stationId("42") shouldBe "Station_42"
  }

  // ── Metro.platformId ─────────────────────────────────────────────────────

  "Metro.platformId" should "add Platform_ prefix" in {
    Metro.platformId(1) should startWith(Metro.PlatformPrefix)
  }

  it should "be exactly Platform_ + code" in {
    Metro.platformId(420) shouldBe "Platform_420"
  }

  // ── Position ──────────────────────────────────────────────────────────────

  "Position" should "place Madrid center at roughly canvas center" in {
    val p = new Position(40.4202961, -3.718762)
    p.x shouldBe (1700.0 +- 1.0)
    p.y shouldBe (1000.0 +- 1.0)
  }

  it should "place a point north of center higher on canvas (smaller y)" in {
    val center = new Position(40.4202961, -3.718762)
    val north  = new Position(40.5, -3.718762)
    north.y should be < center.y
  }

  it should "place a point east of center further right (larger x)" in {
    val center = new Position(40.4202961, -3.718762)
    val east   = new Position(40.4202961, -3.6)
    east.x should be > center.x
  }

  // ── EntranceParser ────────────────────────────────────────────────────────

  "EntranceParser" should "parse a valid entrance JSON" in {
    val json =
      """|{
         |  "entrances": [
         |    { "entrance": { "CODIGOEMPRESA": "101", "ENTRANCE": 948967.0 } },
         |    { "entrance": { "CODIGOEMPRESA": "102", "ENTRANCE": 193500.0 } }
         |  ]
         |}""".stripMargin
    val result = new EntranceParser().parseEntrances(json)
    result should have size 2
    result.map(_.id) should contain ("101")
    result.find(_.id == "101").map(_.entrance) shouldBe Some(948967.0)
  }

  it should "return empty seq for empty entrances array" in {
    val json = """{ "entrances": [] }"""
    new EntranceParser().parseEntrances(json) shouldBe empty
  }

  it should "skip malformed entries" in {
    val json =
      """|{
         |  "entrances": [
         |    { "entrance": { "CODIGOEMPRESA": "101", "ENTRANCE": 100.0 } },
         |    { "entrance": { "MISSING_FIELD": true } }
         |  ]
         |}""".stripMargin
    val result = new EntranceParser().parseEntrances(json)
    result should have size 1
  }

  // ── StationParser ─────────────────────────────────────────────────────────

  "StationParser" should "parse valid station features JSON" in {
    val json =
      """|{
         |  "type": "FeatureCollection",
         |  "features": [
         |    { "properties": {
         |        "DENOMINACION": "SOL",
         |        "CODIGOESTACION": "1",
         |        "CODIGOEMPRESA": "101"
         |    }},
         |    { "properties": {
         |        "DENOMINACION": "GRAN VIA",
         |        "CODIGOESTACION": "2",
         |        "CODIGOEMPRESA": "102"
         |    }}
         |  ]
         |}""".stripMargin
    val result = new StationParser().parseStations(json)
    result should have size 2
    result.map(_.name) should contain ("SOL")
    result.find(_.name == "SOL").map(_.id) shouldBe Some("1")
  }

  it should "return empty seq for no features" in {
    val json = """{ "type": "FeatureCollection", "features": [] }"""
    new StationParser().parseStations(json) shouldBe empty
  }

  it should "skip entries with missing required fields" in {
    val json =
      """|{
         |  "type": "FeatureCollection",
         |  "features": [
         |    { "properties": { "DENOMINACION": "SOL", "CODIGOESTACION": "1", "CODIGOEMPRESA": "101" } },
         |    { "properties": { "DENOMINACION": "INCOMPLETE" } }
         |  ]
         |}""".stripMargin
    val result = new StationParser().parseStations(json)
    result should have size 1
    result.head.name shouldBe "SOL"
  }

  // ── Metro.buildMetroGraph (integration) ───────────────────────────────────

  "Metro.buildMetroGraph" should "build a graph with stations and platforms" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    graph.nodes.size should be > 100
    graph.edges.size should be > 100
    graph.nodes.exists(_.value.name.startsWith(Metro.StationPrefix))   shouldBe true
    graph.nodes.exists(_.value.name.startsWith(Metro.PlatformPrefix))  shouldBe true
  }

  it should "contain at least one interchange (multi-line) station" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    val multiLine = graph.nodes.filter { n =>
      n.value.name.startsWith(Metro.StationPrefix) && n.value.lines.size >= 2
    }
    multiLine.nonEmpty shouldBe true
  }

  it should "produce station nodes with at least one line" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    val stations = graph.nodes.filter(_.value.name.startsWith(Metro.StationPrefix))
    stations.forall(_.value.lines.nonEmpty) shouldBe true
  }
}
