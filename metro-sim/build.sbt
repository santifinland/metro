lazy val root = (project in file(".")).
   settings(
     inThisBuild(List(
       organization := "ch.epfl.scala",
       scalaVersion := "2.13.3"
     )),
     name := "hello-world",
     libraryDependencies ++= Seq(
       "com.typesafe.akka" %% "akka-actor" % "2.6.17",
       "com.typesafe.akka" %% "akka-http" % "10.2.6",
       "com.typesafe.akka" %% "akka-stream" % "2.6.17"
     )
   )
