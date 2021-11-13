// Metro. SDMT

import org.geolatte.geom.{G2D, LineString}


case class Line(features: LineFeatures, geometry: LineString[G2D])

case class LineFeatures(
    numerolineausuario: String,
    sentido: String,
    codigoestacion: String,
    codigoanden: Int,
    numeroorden: Int,
    tipoparada: String,
    denominacion: String,
    codigomunicipio: String,
    municipio: String,
    coronatarifaria: String,
    longitudtramoanterior: Double,
    velocidadtramoanterior: Float,
    modolinea: Int,
    modointercambiador: Int,
    codigointercambiador: String,
    idftramo: String,
    idflinea: String,
    idfitinerario: String,
    idfestacion: String,
    idfposte: String,
    idfanden: String
)

case class LineGeometry(geometryType: String, coordinates: Seq[Seq[Double]])
