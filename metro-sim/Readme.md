# Metro simulator

Actor based metro Monte Carlo simulator with people, trains, platforms and stations.

An extra actor for gathering and communicating metrics to user interface exists.

The following fluxes are simulated:

## Person
A person is given a path to be followed through the metro network.
This path starts and ends in a station.

The person requests to enter the assigned start station.

Once the station grants the access to the person,
the person request access to the next node.

If the next node is a platform, the person request access to that platform.

Once the platform grants access to the person, 
the person enters into the platform of a given station,
waits for a train to enter the platform,
and enters the train when a train arrives to the platform.

The person arrives to a platform of an intermediate or final destination.

The person can walk through the different platforms of a single station.

The person keeps track of its current station and platform.

The following messages are issued by a person:

| Message                    |  Destination Actor |  Message parameters  |
|----------------------------|:------------------:|:--------------------:|
| RequestEnterStation        | Station            |                      |
| RequestEnterPlatform       | Platform           |                      |
| RequestEnterTrain          | Train              | self: ActorRef       |
| ExitTrain                  | Train              |                      |
| ExitPlatform               | Platform           |                      |
| EnteredPlatformFromTrain   | Platform           |                      |
| EnteredStationFromPlatform | Platform           |                      |

The following messages are received by a person:

| Message                  |  Origin Actor      |  Message parameters  |
|--------------------------|:------------------:|:--------------------:|
| AcceptedEnterStation     | Station            |                      |
| NotAcceptedEnterStation  | Station            |                      |
| AcceptedEnterPlatform    | Platform           | self: ActorRef       |
| NotAcceptedEnterPlatform | Platform           |                      |
| TrainInPlatform          | Platform           | train: ActorRef      |


## Platform
A platform is entered by users to wait for a train.

A platform is entered by trains to collect and release people.

A Platform keeps track of people inside it.

The following messages are issued by a platform

| Message                  |  Destination Actor |  Message parameters  |
|--------------------------|:------------------:|:--------------------:|
| NextPlatform             | Platform           | next: ActorRef       |
| AcceptedEnterPlatform    | Person             | self: ActorRef       |
| RequestEnterStation      | Station            |                      |
| NotAcceptedEnterPlatform | Person             |                      |
| TrainInPlatform          | Person             | train: ActorRef      |
| FullPlatform             | Train              | self: ActorRef       |
| PlatformReserved         | Train              | self: ActorRef       |
| PeopleInPlatform         | Line               | people: Int          |


The following messages are received by a platform

| Message                  |  Origin Actor      |  Message parameters  |
|--------------------------|:------------------:|:--------------------:|
| NextPlatform             | Platform           | self: ActorRef       |
| ArrivedAtPlatform        | Train              |                      |
| LeavingPlatform          | Train              |                      |
| GetNextPlatform          | Train              |                      |
| ReservePlatform          | Train              |                      |
| EnteredPlatformFromTrain | Person             |                      |


## Train
Trains are initialized at certain platforms with no people inside.

Trains reserve a platform to go to, and when this platform is granted,
the train moves to that platform.

People in platforms get into trains and they get out of the train when
arriving to an intermediate or final destination.

A train keeps track of people inside it.

The following messages are issued by a train

| Message                   |  Destination Actor |  Message parameters  |
|---------------------------|:------------------:|:--------------------:|
| TrainArrivedAtPlatform    | Train              |                      |
| ArrivedAtPlatform         | Platform           |                      |
| LeavingPlatform           | Platform           |                      |
| GetNextPlatform           | Platform           |                      |
| ReservePlatform           | Platform           |                      |
| AcceptedEnterTrain        | Person             | platform: ActorRef   |
| NotAcceptedEnterTrain     | Person             |                      |
| ArrivedAtPlatformToPeople | Person             | platform: ActorRef   |

The following messages are received by a train

| Message                 |  Origin Actor      |  Message parameters  |
|-------------------------|:------------------:|:--------------------:|
| TrainArrivedAtPlatform  | Train              |                      |
| FullPlatform            | Platform           | self: ActorRef       |
| PlatformReserved        | Platform           | self: ActorRef       |
| NextPlatform            | Platform           | self: ActorRef       |
| RequestEnterTrain       | Person             | self: ActorRef       |
| ExitTrain               | Person             |                      |
| Move                    | Main application   | platform: ActorRef   |


## Station
A station can have different platforms.

A person enters a station without asking permission.

A person walks inside the station to reach the desired platform.

A station keeps track of people inside it.

The following messages are issued by a Station

| Message                 |  Destination Actor |  Message parameters  |
|-------------------------|:------------------:|:--------------------:|
| AcceptedEnterStation    | Person             |                      |
| NotAcceptedEnterStation | Person             |                      |
| PeopleInStation         | Line               | people: Int          |

The following messages are received by a station

| Message                    |  Origin Actor      |  Message parameters  |
|----------------------------|:------------------:|:--------------------:|
| RequestEnterStation        | Person             | self: ActorRef       |
| EnteredStationFromPlatform | Person             |                      |
| ExitStation                | Person             |                      |


# Simulator
The metro simulator is managed by a single Simulator Actor
The metro simulator spawns Persons as they are supposed to appear in stations.
The metro simulator removes Persons from the simulation as they reach their final destination.

The following messages are issued by the Simulator

| Message  | Destination Actor | Message parameters |
|----------|:-----------------:|:------------------:|
| Simulate | Simulator         |                    |


The following messages are received by the Simulator

| Message              |  Origin Actor      |  Message parameters  |
|----------------------|:------------------:|:--------------------:|
| Simulate             | Simulator          |                      |
| ArrivedToDestination | Person             |                      |
