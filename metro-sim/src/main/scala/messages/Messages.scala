// Metro. SDMT
package messages

import org.apache.pekko.actor.typed.ActorRef


object Messages {

  // ─── Person messages (sent TO a Person actor) ─────────────────────────────
  sealed trait PersonMessage
  case class AcceptedEnterStation(station: ActorRef[StationMessage]) extends PersonMessage
  case object NotAcceptedEnterStation extends PersonMessage
  case class AcceptedEnterPlatform(platform: ActorRef[PlatformMessage]) extends PersonMessage
  case object NotAcceptedEnterPlatform extends PersonMessage
  case class TrainInPlatform(train: ActorRef[TrainMessage]) extends PersonMessage
  case class AcceptedEnterTrain(platform: ActorRef[PlatformMessage]) extends PersonMessage
  case object NotAcceptedEnterTrain extends PersonMessage
  case class ArrivedAtPlatformToPeople(platform: ActorRef[PlatformMessage]) extends PersonMessage
  case object DebugPerson extends PersonMessage

  // ─── Station messages (sent TO a Station actor) ───────────────────────────
  sealed trait StationMessage
  case class RequestEnterStation(person: ActorRef[PersonMessage]) extends StationMessage
  case class ExitStation(personId: String) extends StationMessage
  case class EnteredStationFromPlatform(person: ActorRef[PersonMessage]) extends StationMessage
  case object StationStatsTick extends StationMessage
  case object ResetStation extends StationMessage

  // ─── Platform messages (sent TO a Platform actor) ─────────────────────────
  sealed trait PlatformMessage
  case class RequestEnterPlatform(person: ActorRef[PersonMessage]) extends PlatformMessage
  case class ExitPlatform(personId: String) extends PlatformMessage
  case class EnteredPlatformFromTrain(person: ActorRef[PersonMessage]) extends PlatformMessage
  case class ReservePlatform(train: ActorRef[TrainMessage]) extends PlatformMessage
  case class ArrivedAtPlatform(train: ActorRef[TrainMessage]) extends PlatformMessage
  case object LeavingPlatform extends PlatformMessage
  case class GetNextPlatform(train: ActorRef[TrainMessage]) extends PlatformMessage
  case class SetNextPlatform(next: ActorRef[PlatformMessage]) extends PlatformMessage
  case object PlatformStatsTick extends PlatformMessage
  case object ResetPlatform extends PlatformMessage

  // ─── Train messages (sent TO a Train actor) ───────────────────────────────
  sealed trait TrainMessage
  case class Move(platform: ActorRef[PlatformMessage]) extends TrainMessage
  case class PlatformReserved(platform: ActorRef[PlatformMessage]) extends TrainMessage
  case class FullPlatform(platform: ActorRef[PlatformMessage]) extends TrainMessage
  case object TrainArrivedAtPlatform extends TrainMessage
  case class NextPlatformForTrain(platform: ActorRef[PlatformMessage]) extends TrainMessage
  case class RequestEnterTrain(person: ActorRef[PersonMessage]) extends TrainMessage
  case class ExitTrain(personId: String) extends TrainMessage
  case object TrainStatsTick extends TrainMessage
  case class ResetTrain(startPlatform: ActorRef[PlatformMessage]) extends TrainMessage

  // ─── Line messages (sent TO a Line actor) ─────────────────────────────────
  sealed trait LineMessage
  case class PeopleInPlatform(platformId: String, people: Int) extends LineMessage
  case class PeopleInStation(stationId: String, people: Int) extends LineMessage
  case object LineTick extends LineMessage

  // ─── UI messages (sent TO the UI actor) ───────────────────────────────────
  sealed trait UIMessage
  case class PeopleInTrain(trainId: String, people: Int) extends UIMessage
  case class PeopleInLinePlatforms(lineId: String, people: Int) extends UIMessage
  case class PeopleInLineStations(lineId: String, people: Int) extends UIMessage
  case class PlatformOvercrowded(platformId: String, people: Int) extends UIMessage
  case class StationOvercrowded(stationId: String, people: Int) extends UIMessage
  case class PeopleInMetro(people: Int) extends UIMessage
  case class PeopleInSimulation(people: Int) extends UIMessage
  case object UITrainsTick extends UIMessage
  case object UISimTimeTick extends UIMessage

  // ─── Simulator messages (sent TO the Simulator actor) ────────────────────
  sealed trait SimulatorMessage
  case object SimulateStep extends SimulatorMessage
  case class ArrivedToDestination(person: ActorRef[PersonMessage]) extends SimulatorMessage
  case object SimulatorStatsTick extends SimulatorMessage
  case object ResetSimulator extends SimulatorMessage
}
