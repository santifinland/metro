# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Metro is a Madrid metro simulation system consisting of three components that work together via WebSocket communication.

## Build and Run Commands

### Simulator (metro-sim) - Scala/Akka
```bash
cd metro-sim
sbt compile           # Compile
sbt run               # Run simulator (starts WebSocket server on port 8081)
```

### Frontend (metro) - Angular
```bash
cd metro
npm install           # Install dependencies
npm start             # Start dev server at http://localhost:4200
npm test              # Run unit tests via Karma
npm run build         # Production build (outputs to dist/)
```

### WebSocket Server (metro-server) - Node.js
```bash
cd metro-server
npm install
node metro.js         # Starts WebSocket relay on port 8081
```

## Architecture

### Three-Component System
1. **metro-sim**: Actor-based Monte Carlo simulator built with Akka. Simulates people, trains, platforms, and stations. Runs a WebSocket server on port 8081 to broadcast simulation state.
2. **metro**: Angular frontend that visualizes the metro network on HTML5 canvas with pan/zoom. Receives real-time updates via WebSocket.
3. **metro-server**: Simple Node.js WebSocket relay (alternative to simulator's built-in server).

### Simulator Actor Model (metro-sim/src/main/scala/)
The simulator uses an actor-per-entity design:
- **Main.scala**: Entry point. Parses metro data, builds graph, spawns all actors, initializes trains
- **Metro.scala**: Builds directed graph with StationNode and PlatformNode. Edges connect stations↔platforms and platforms↔platforms
- **Simulator.scala**: Orchestrates simulation, spawns Person actors based on station entrance data
- **Person.scala**: Navigates through the network following computed shortest path
- **Train.scala**: Moves between platforms, accepts/releases passengers
- **Platform.scala**: Manages queue of waiting people, coordinates train arrivals
- **Station.scala**: Entry point for people into the metro system
- **UI.scala**: Aggregates metrics and broadcasts to WebSocket clients

### Message Flow
Actors communicate via typed messages defined in `messages/Messages.scala`. Key patterns:
- Person→Station: RequestEnterStation
- Person→Platform: RequestEnterPlatform
- Person→Train: RequestEnterTrain
- Train→Platform: ReservePlatform, ArrivedAtPlatform, LeavingPlatform
- Platform→Train: PlatformReserved, NextPlatform

### Frontend (metro/src/app/)
- **train.component.ts**: Main visualization component. Renders three canvas layers (stations, paths, trains) with synchronized pan/zoom. Handles WebSocket messages for train positions and people counts.
- **madrid.ts**: Loads station and path data from JSON assets

### Data Files (data/)
JSON files containing Madrid metro network data:
- `stations.json`: Station metadata
- `tramos.json`: Track segments with geometry
- `entrance.json`: Daily passenger counts per station
- `L*.json`: Per-line track data

## Configuration

Simulation time multiplier is set in `metro-sim/src/main/resources/application.conf`:
```
time-multiplier = 10  # Higher = faster simulation
```

## GitHub Style

- Branch naming: `feature/*` for new features, `fix/*` for bug fixes
- Avoid the Generated with Claude Code disclaimer
