// Metro. SDMT

import scala.collection.immutable.SortedMap


class Distribution(distribution: SortedMap[Double, Int]) {

  def value(uniform_probability: Double): Int = {
    val f: SortedMap[Double, Int] = distribution.filter { case (p, _) => uniform_probability > p }
    if (f.isEmpty) 0 else f.last._2
  }
}
