// Metro. SDMT

package parser

import org.geolatte.geom._
import org.geolatte.geom.crs.CoordinateReferenceSystems.{WGS84, addLinearSystem}
import org.geolatte.geom.crs.{CoordinateReferenceSystem, Unit => U}
import org.geolatte.geom.syntax.GeometryImplicits.{lineString, positionSeqBuilder, tupleToG2D}
import play.api.libs.functional.syntax.toFunctionalBuilderOps
import play.api.libs.json.Format.GenericFormat
import play.api.libs.json._


case class Tramo(features: JsValue, geometries: JsValue)

class MetroParser(metro: String) {

  def parseMetro(metro: String): Seq[Path] = {
    val raw: JsValue = Json.parse(metro)
    val features: Seq[JsValue] = (raw \ "features" \\ "properties").toSeq
    val geometries: Seq[JsValue] = (raw \ "features" \\ "geometry").toSeq
    features.lazyZip(geometries).flatMap((f, g) => parseTramo(f, g))
  }

  def parseTramo(f: JsValue, g: JsValue): Option[Path] = {
    val features: Option[LineFeatures] = (f).validate(tramoReads) match {
      case s: JsSuccess[LineFeatures] => Some(s.value)
      case e: JsError => {
        scribe.debug(s"Error $e")
        scribe.debug(s"Error ${e.errors}")
        None
      }
    }
    val geometry: Option[LineGeometry] = (g).validate(geometryReads) match {
      case s: JsSuccess[LineGeometry] => Some(s.value)
      case _: JsError => None
    }
    if (features.isDefined && geometry.isDefined) {
      implicit val crs: CoordinateReferenceSystem[G2D] = addLinearSystem(WGS84, classOf[G2D], U.METER)
      val ls = lineString(crs)(geometry.get.coordinates.map(xs => (xs.head, xs.last)): _*)
      Some(Path(features.get, ls))
    } else {
      None
    }
  }

  implicit val tramoReads: Reads[LineFeatures] = (
    (JsPath \ "NUMEROLINEAUSUARIO").read[String] and
      (JsPath \ "SENTIDO").read[String] and
      (JsPath \ "CODIGOESTACION").read[String] and
      (JsPath \ "CODIGOANDEN").read[Int] and
      (JsPath \ "NUMEROORDEN").read[Int] and
      (JsPath \ "TIPOPARADA").read[String] and
      (JsPath \ "DENOMINACION").read[String] and
      (JsPath \ "CODIGOMUNICIPIO").read[String] and
      (JsPath \ "MUNICIPIO").read[String] and
      (JsPath \ "CORONATARIFARIA").read[String] and
      (JsPath \ "LONGITUDTRAMOANTERIOR").read[Double] and
      (JsPath \ "VELOCIDADTRAMOANTERIOR").read[Float] and
      (JsPath \ "MODOLINEA").read[Int] and
      (JsPath \ "MODOINTERCAMBIADOR").readNullable[Int] and
      (JsPath \ "CODIGOINTERCAMBIADOR").readNullable[String] and
      (JsPath \ "IDFTRAMO").read[String] and
      (JsPath \ "IDFLINEA").read[String] and
      (JsPath \ "IDFITINERARIO").read[String] and
      (JsPath \ "IDFESTACION").read[String] and
      (JsPath \ "IDFPOSTE").read[String] and
      (JsPath \ "IDFANDEN").read[String]
  )(LineFeatures.apply _)


  implicit val geometryReads: Reads[LineGeometry] = (
    (JsPath \ "type").read[String] and
      (JsPath \ "coordinates").read[Seq[Seq[Double]]]
    )(LineGeometry.apply _)
}
