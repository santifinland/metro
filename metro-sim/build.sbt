lazy val root = (project in file(".")).
   settings(
     inThisBuild(List(
       organization := "sdmt",
       scalaVersion := "2.13.3"
     )),
     name := "metro",
     libraryDependencies ++= Seq(
       "com.github.pureconfig" %% "pureconfig" % "0.17.0",
       "com.outr" %% "scribe" % "3.6.3",
       "org.scala-graph" %% "graph-core" % "1.13.2",
       "org.apache.pekko" %% "pekko-actor-typed" % "1.1.3",
       "org.apache.pekko" %% "pekko-http" % "1.1.0",
       "org.apache.pekko" %% "pekko-stream" % "1.1.3",
       "org.apache.pekko" %% "pekko-slf4j" % "1.1.3",
       "com.typesafe.play" %% "play-json" % "2.9.2",
       "org.geolatte" % "geolatte-geom" % "1.8.2",
       "org.geolatte" %% "geolatte-geom-scala" % "1.7.0",
       "org.scalatest" %% "scalatest" % "3.2.17" % Test
     )
   )
