lazy val root = (project in file(".")).
   settings(
     inThisBuild(List(
       organization := "sdmt",
       scalaVersion := "2.13.3"
     )),
     name := "metro",
     libraryDependencies ++= Seq(
       "com.github.pureconfig" %% "pureconfig" % "0.17.0",
       "com.typesafe.akka" %% "akka-actor" % "2.6.17",
       "com.typesafe.akka" %% "akka-http" % "10.2.6",
       "com.typesafe.akka" %% "akka-stream" % "2.6.17",
       "com.typesafe.play" %% "play-json" % "2.9.2",
       "org.geolatte" % "geolatte-geom" % "1.8.2",
       "au.id.jazzy" %% "play-geojson" % "1.7.0",
       "io.circe" %% "circe-core" % "0.14.1",
       "io.circe" %% "circe-generic" % "0.14.1",
       "io.circe" %% "circe-parser" % "0.14.1"
     )
   )
