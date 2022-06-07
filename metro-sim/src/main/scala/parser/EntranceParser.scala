// Metro. SDMT

package parser

import play.api.libs.functional.syntax.toFunctionalBuilderOps
import play.api.libs.json.Format.GenericFormat
import play.api.libs.json._


case class Entrance(id: String, entrance: Double)


class EntranceParser {

  def parseEntrances(entrance: String): Seq[Entrance] = {
    val raw: JsValue = Json.parse(entrance)
    (raw \ "entrances" \\ "entrance")
      .toSeq
      .flatMap(x => parseEntrance(x))
  }

  def parseEntrance(e: JsValue): Option[Entrance] = {
    e.validate(entranceReads) match {
      case s: JsSuccess[Entrance] => Some(s.value)
      case e: JsError =>
        scribe.debug(s"Error $e")
        scribe.debug(s"Error ${e.errors}")
        None
    }
  }

  implicit val entranceReads: Reads[Entrance] = (
    (JsPath \ "CODIGOEMPRESA").read[String] and
      (JsPath \ "ENTRANCE").read[Double]
  )(Entrance.apply _)
}

