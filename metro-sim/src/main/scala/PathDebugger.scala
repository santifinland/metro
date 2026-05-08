// PathDebugger — shortest-path query tool for runtime debugging.
//
// Usage from the browser (WebSocket):
//   Send:    {"message": "queryPath", "from": "<station>", "to": "<station>"}
//   Receive: {"message": "pathResult", "from": "...", "to": "...",
//             "found": true|false, "nodes": [...]}
//
// The "from"/"to" strings are matched case-insensitively against station
// denominacion (e.g. "EMPALME", "Casa de Campo", "batan").
// The first matching STATION node (not platform) is used as the endpoint.
//
// Each node in the returned "nodes" array has:
//   "kind"  : "station" | "platform"
//   "id"    : the internal graph node name
//   "label" : a human-readable label ("EMPALME", "CASA DE CAMPO (andén 420)", …)
//   "line"  : the line(s) the node belongs to, comma-separated

import scalax.collection.Graph
import scalax.collection.edge.WDiEdge


object PathDebugger {

  /**
   * Computes the shortest weighted path between two stations in the metro graph
   * and returns a JSON string suitable for broadcasting via WebSocket.
   *
   * @param graph     The fully-built metro graph (MetroNode nodes, WDiEdge edges).
   * @param fromQuery Partial or full station name for the origin (case-insensitive).
   * @param toQuery   Partial or full station name for the destination (case-insensitive).
   * @return          A JSON string with key "message" = "pathResult".
   */
  def findPath(graph: Graph[MetroNode, WDiEdge], fromQuery: String, toQuery: String): String = {
    val fromUp = fromQuery.trim.toUpperCase
    val toUp   = toQuery.trim.toUpperCase

    // Station nodes only (not platforms) — we route station-to-station
    val stationNodes = graph.nodes.filter(_.value.name.startsWith(Metro.StationPrefix))

    val fromNode = stationNodes.find(n => n.value.label.toUpperCase.contains(fromUp))
    val toNode   = stationNodes.find(n => n.value.label.toUpperCase.contains(toUp))

    (fromNode, toNode) match {
      case (None, _) =>
        errorJson(fromQuery, toQuery, s"Station not found: $fromQuery")

      case (_, None) =>
        errorJson(fromQuery, toQuery, s"Station not found: $toQuery")

      case (Some(src), Some(dst)) if src == dst =>
        errorJson(fromQuery, toQuery, "Origin and destination are the same node")

      case (Some(src), Some(dst)) =>
        val journey = src.shortestPathTo(dst, (e: graph.EdgeT) => e.weight)
        journey match {
          case None =>
            errorJson(fromQuery, toQuery, s"No path found from $fromQuery to $toQuery")

          case Some(p) =>
            val nodesJson = p.nodes.map { n =>
              val isStation = n.value.name.startsWith(Metro.StationPrefix)
              val kind      = if (isStation) "station" else "platform"
              val label     = if (n.value.name.startsWith(Metro.StationPrefix)) n.value.label
                              else s"${n.value.label} (andén ${n.value.name.stripPrefix(Metro.PlatformPrefix)})"
              val lines     = n.value.lines.mkString(", ")
              s"""{"kind":"$kind","id":"${n.value.name}","label":"$label","line":"$lines"}"""
            }.mkString("[", ",", "]")

            s"""{"message":"pathResult","from":"$fromQuery","to":"$toQuery","found":true,"nodes":$nodesJson}"""
        }
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private def errorJson(from: String, to: String, reason: String): String =
    s"""{"message":"pathResult","from":"$from","to":"$to","found":false,"error":"$reason","nodes":[]}"""

}
