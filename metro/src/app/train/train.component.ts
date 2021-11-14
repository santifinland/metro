import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { webSocket } from "rxjs/webSocket";

import Panzoom from '@panzoom/panzoom'

import { Madrid } from '../madrid'
import { Position } from '../position'
import { Station } from '../station'
import { Train } from '../train'


@Component({
  selector: 'app-train',
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit {

  @ViewChild('canvas_stations', {static: false, read: ElementRef}) canvasStations!: ElementRef;
  @ViewChild('canvas', {static: false, read: ElementRef}) canvas!: ElementRef;
  public ctxStations!: CanvasRenderingContext2D;
  public ctx!: CanvasRenderingContext2D;

  width = 1500;
  height = 1500;
  stations: Station[];
  trains: Train[];

  constructor() {
    const madrid: Madrid = new Madrid(this.width, this.height)
    this.stations = madrid.stations
    const opera: Station = this.stations.filter(s => s.name == "OPERA")[0]
    this.trains = [new Train("1", opera.position)]
  }

  ngAfterViewInit(): void {
    this.ctxStations = this.canvasStations.nativeElement.getContext('2d');
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.drawStations(this.ctxStations, this.stations);
    this.drawTrains(this.trains);
    const panzoomStations = Panzoom(this.canvasStations.nativeElement, {
      maxScale: 10,
      canvas: true,
      step: 0.2
    })
    const panzoom = Panzoom(this.canvas.nativeElement, {
      maxScale: 10,
      canvas: true,
      step: 0.2
    })
    this.canvas.nativeElement.parentElement.addEventListener('wheel', function (event: any) {
      if (!event.shiftKey) return
      const pan = panzoom.getPan()
      panzoomStations.zoomWithWheel(event);
      panzoom.zoomWithWheel(event);
      panzoom.pan(pan.x, pan.y);
      panzoomStations.pan(pan.x, pan.y);
    })
    const subject = webSocket("ws://localhost:8081/ws");
    subject.subscribe(
      msg => {
        const rawMsg: string = JSON.stringify(msg, undefined, 4);
        const movement = JSON.parse(rawMsg);
        console.log(movement.train);
        console.log(movement.station);
        console.log(movement.slot);
        const station: Station | undefined = this.stations.find(x => x.name === movement.station)
        if (station) {
          this.moveTrain(this.trains[0], station.position)
        }
      },
      err => console.log(err),
      () => console.log('complete')
    );
  }

  drawStations(ctx: CanvasRenderingContext2D, stations: Station[]) {
    ctx.fillStyle = 'green';
    for (let station of stations) {
      if (station.next !== undefined) {
        ctx.beginPath()
        ctx.moveTo(station.position.x, station.position.y);
        ctx.fillStyle = 'white';
        ctx.lineTo(station.next.position.x, station.next.position.y);
        ctx.lineTo(station.next.position.x, station.next.position.y + 3);
        ctx.lineTo(station.position.x, station.position.y + 3);
        ctx.fill()
        ctx.fillStyle = 'green';
        ctx.closePath();
      }
      if ((station.path.length > 0)) {
        ctx.fillRect(station.position.x, station.position.y, 2, 2);
        ctx.lineWidth = 1;
        ctx.strokeText(station.name, station.position.x, station.position.y)
        if (station.name === "EMPALME") {
          console.log(station);
        }
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(station.path[0].x, station.path[0].y);
        for (let p of station.path.slice(1)) {
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        //for (let p of station.path.reverse()) {
          //ctx.lineTo(p.x + 2, p.y + 2);
        //}
        //ctx.fill();
        ctx.closePath();
      }
    }
  }

  drawTrains(trains: Train[]) {
    this.ctx.fillStyle = 'red';
    for (let train of trains) {
      this.ctx.fillRect(train.position.x, train.position.y,4,4);
    }
  }

  moveTrain(train: Train, position: Position) {
    this.ctx.clearRect(train.position.x - 0.5, train.position.y - 0.5,5,5);
    train.position.x = position.x;
    train.position.y = position.y;
    this.drawTrains([train]);
  }
}
