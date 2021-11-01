import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { webSocket } from "rxjs/webSocket";

import Panzoom from '@panzoom/panzoom'

import { Madrid } from '../madrid'
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

  width = 1250;
  height = 1000;
  stations: Station[];
  trains: Train[];

  constructor() {
    const madrid: Madrid = new Madrid(this.width, this.height)
    this.stations = madrid.stations
    this.trains = [new Train(1, madrid.ppio().position)]
    const subject = webSocket("ws://localhost:8081/ws");
    subject.subscribe(
      msg => console.log('message received: ' + JSON.stringify(msg, undefined, 4)),
      err => console.log(err),
      () => console.log('complete')
    );
  }

  ngAfterViewInit(): void {
    this.ctxStations = this.canvasStations.nativeElement.getContext('2d');
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.drawStations(this.ctxStations, this.stations);
    this.drawTrains(this.trains);
    const panzoomStations = Panzoom(this.canvasStations.nativeElement, {
      maxScale: 10,
      canvas: true
    })
    const panzoom = Panzoom(this.canvas.nativeElement, {
      maxScale: 10,
      canvas: true
    })
    this.canvas.nativeElement.parentElement.addEventListener('wheel', function (event: any) {
      if (!event.shiftKey) return
      panzoomStations.zoomWithWheel(event);
      panzoom.zoomWithWheel(event);
      const pan = panzoom.getPan()
      pan.y = pan.y + 100 * event.deltaY > 0 ? 1 : -1;
      pan.x = pan.x + 100 * event.deltaY > 0 ? 1 : -1;
      panzoomStations.pan(pan.x, pan.y);
      panzoom.pan(pan.x, pan.y);
      panzoomStations.pan(pan.x, pan.y);
    })
    this.moveTrain(this.trains[0])
  }

  drawStations(ctx: CanvasRenderingContext2D, stations: Station[]) {
    ctx.fillStyle = 'green';
    for (let station of stations) {
      ctx.fillRect(station.position.x, station.position.y, 2, 2);
      ctx.strokeText(station.name, station.position.x, station.position.y)
      ctx.beginPath()
      ctx.moveTo(station.position.x, station.position.y);
      if (station.next !== undefined) {
        ctx.fillStyle = 'white';
        ctx.lineTo(station.next.position.x, station.next.position.y);
        ctx.lineTo(station.next.position.x, station.next.position.y + 3);
        ctx.lineTo(station.position.x, station.position.y + 3);
        ctx.fill()
        ctx.fillStyle = 'green';
      }
    }
  }

  drawTrains(trains: Train[]) {
    this.ctx.fillStyle = 'red';
    for (let train of trains) {
      this.ctx.fillRect(train.position.x, train.position.y,4,4);
    }
  }

  moveTrain(train: Train) {
    this.ctx.clearRect(train.position.x, train.position.y,4,4.2);
    train.position.x = train.position.x + 5
    train.position.y = train.position.y - 1
    this.drawTrains([train])
    setTimeout(() => {
      this.moveTrain(train);
    }, 1000);
  }
}
