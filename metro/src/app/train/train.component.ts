import {Component, ViewChild, ElementRef, AfterViewInit} from '@angular/core';
import {webSocket} from "rxjs/webSocket";
import {interval, Observable, Subscription} from "rxjs";

import Panzoom from '@panzoom/panzoom'

import {Madrid} from '../madrid'
import {Station} from '../station'
import {Train} from '../train'


@Component({
  selector: 'app-train',
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit {

  @ViewChild('canvas_stations', {static: false, read: ElementRef}) canvasStations!: ElementRef;
  @ViewChild('canvas_paths', {static: false, read: ElementRef}) canvasPaths!: ElementRef;
  @ViewChild('canvas_trains', {static: false, read: ElementRef}) canvasTrains!: ElementRef;
  public ctxStations!: CanvasRenderingContext2D;
  public ctx!: CanvasRenderingContext2D;
  public ctxTrains!: CanvasRenderingContext2D;

  width = 3400;
  height = 2000;
  stations: Station[];
  paths: Station[];
  trains: Train[] = [];

  simulationPeople: number = 0;
  metroPeople: number = 0;
  platformsPeople: Map<string, number> = new Map();
  stationsPeople: Map<string, number> = new Map();
  trainsPeople: number = 0;

  subscription!: Subscription;
  clockSubscription!: Subscription;
  period: number = 2000;
  time: number = 6 * 3600 * 1000;
  timeMultiplier: number = 1;

  constructor() {
    const madrid: Madrid = new Madrid(this.width, this.height);
    this.stations = madrid.stations;
    this.paths = madrid.paths;
    new Set(this.paths.map(x => x.line)).forEach(x => this.platformsPeople.set(x, 0))
    new Set(this.paths.map(x => x.line)).forEach(x => this.stationsPeople.set(x, 0))
  }

  ngAfterViewInit(): void {
    this.ctxStations = this.canvasStations.nativeElement.getContext('2d');
    this.ctx = this.canvasPaths.nativeElement.getContext('2d');
    this.ctxTrains = this.canvasTrains.nativeElement.getContext('2d');
    this.ctxTrains.fillStyle = 'red';
    this.drawPaths(this.ctx, this.paths);
    this.drawStations(this.ctxStations, this.stations);
    this.panAndZoom();
    this.handleMessages();
    const source = interval(this.period);
    this.subscription = source.subscribe(_ => this.drawTrains(this.trains));
    this.clockSubscription = source.subscribe(_ => this.clock())
  }

  panAndZoom() {
    const panzoomStations = Panzoom(this.canvasStations.nativeElement, {
      maxScale: 10,
      canvas: true,
      step: 0.2
    })
    const panzoom = Panzoom(this.canvasPaths.nativeElement, {
      maxScale: 10,
      canvas: true,
      step: 0.2
    })
    const panzoomTrains = Panzoom(this.canvasTrains.nativeElement, {
      maxScale: 10,
      canvas: true,
      step: 0.2
    })
    this.canvasTrains.nativeElement.parentElement.addEventListener('wheel', function (event: any) {
      if (!event.shiftKey) return
      const pan = panzoomTrains.getPan()
      panzoomStations.zoomWithWheel(event);
      panzoomTrains.zoomWithWheel(event);
      panzoom.zoomWithWheel(event);
      panzoom.pan(pan.x, pan.y);
      panzoomStations.pan(pan.x, pan.y);
      panzoomTrains.pan(pan.x, pan.y);
    })
  }

  handleMessages() {
    const subject = webSocket("ws://localhost:8081/ws");
    subject.subscribe(
      msg => {
        const rawMsg: string = JSON.stringify(msg, undefined, 4);
        const m = JSON.parse(rawMsg);

        if (m.message === "moveTrain") {
          for (let train of this.trains) {
            if (train.id === m.train) {
              train.x = m.x;
              train.y = m.y;
            }
          }
        }

        if (m.message === "peopleInLinePlatforms") {
          this.platformsPeople.set(m.line.slice(1), m.people)
        }

        if (m.message === "peopleInLineStations") {
          this.stationsPeople.set(m.line.slice(1), m.people)
        }

        if (m.message === "peopleInTrains") {
          this.trainsPeople = m.people;
        }

        if (m.message === "peopleInMetro") {
          this.metroPeople = m.people;
        }

        if (m.message === "peopleInSimulation") {
          this.simulationPeople = m.people;
        }

        if (m.message === "platformOvercrowded") {
          console.log(m.platform + " with " + m.people)
        }

        if (m.message === "stationOvercrowded") {
          console.log(m.platform + " with " + m.people)
        }

        if (m.message === "newTrain") {
          this.addTrain(m.train, m.x, m.y)
        }

        if (m.message === "timeMultiplier") {
          console.log(m);
          this.timeMultiplier = m.multiplier;
        }
      },
      err => console.log(err),
      () => console.log('complete')
    );
  }

  addTrain(train: string, x: number, y: number): void {
    this.trains.push(new Train(train, x, y));
  }

  drawStations(ctx: CanvasRenderingContext2D, stations: Station[]) {
    ctx.font = '8px Verdana';
    for (let station of stations) {
      ctx.lineWidth = 0.6;
      ctx.strokeText(station.name, station.position.x + 7, station.position.y + 3);
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(station.position.x, station.position.y, 5, 0, Math.PI * 2, true); // Outer circle
      ctx.fillStyle = 'white';
      ctx.fill()
      ctx.stroke();
      ctx.closePath();
    }
  }

  drawPaths(ctx: CanvasRenderingContext2D, stations: Station[]) {
    for (let station of stations) {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(station.path[0].x, station.path[0].y);
      for (let p of station.path.slice(1)) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = this.lineColors(station.line);
      ctx.stroke();
      ctx.closePath();
    }

  }

  drawTrains(trains: Train[]): void {
    this.ctxTrains.clearRect(0, 0, this.width, this.height);
    for (let train of trains) {
      this.ctxTrains.fillRect(train.x, train.y, 15, 5);
    }
  }

  lineColors(line: string): string {
    switch (line) {
      case "1":
        return "#0097C9";
      case "2":
        return "#FF0E00";
      case "3":
        return "#FFBF00";
      case "4":
        return "#930C15";
      case "5":
        return "#4BC400";
      case "6-1":
        return "#9D9793";
      case "6-2":
        return "#9D9793";
      case "7a":
        return "#FF9B0D";
      case "7b":
        return "#FF9B0D";
      case "8":
        return "#FF5D9D";
      case "9A":
        return "#B51580";
      case "9B":
        return "#B51580";
      case "10a":
        return "#001A8E";
      case "10b":
        return "#001A8E";
      case "11":
        return "#006D21";
      case "12-1":
        return "#939301";
      case "12-2":
        return "#939301";
      case "R":
        return "white";
      default:
        return "red";
    }
  }

  clock(): void {
    console.log(this.time);
    this.time = this.time + (this.period / this.timeMultiplier);
  }

  displayClock() {
      return new Date(this.time).toLocaleTimeString('en-GB', {
        timeZone: 'Etc/UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
  }

  linePeople() {
    return Array
      .from(this.platformsPeople.entries())
      .sort((a, b) => a[1] > b[1] ? -1 : 1);
  }

  allPeople(recipient: Map<string, number>): number {
    return Array.from(recipient.values()).reduce((p, c) => p + c)
  }

  computeCheckPeople(): number {
    return this.metroPeople - this.trainsPeople - this.allPeople(this.platformsPeople) -
      this.allPeople(this.stationsPeople)
  }




}
