import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

import Panzoom from '@panzoom/panzoom'

import { Position } from '../position'
import { Station } from '../station'


@Component({
  selector: 'app-train',
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit {

  @ViewChild('canvas', {static: false, read: ElementRef}) canvas!: ElementRef;
  public ctx!: CanvasRenderingContext2D;

  width = 1250;
  height = 1000;
  stations: Station;
  train: Position;

  constructor() {
    this.stations = new Station(this.width, this.height);
    this.train = new Position(this.width, this.height, this.stations.ppio.lat, this.stations.ppio.lon)
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.drawStations(this.ctx);
    this.drawTrain(this.ctx);
    const panzoom = Panzoom(this.canvas.nativeElement, {
      maxScale: 10,
      canvas: true
    })
    this.canvas.nativeElement.parentElement.addEventListener('wheel', function (event: any) {
      if (!event.shiftKey) return
      panzoom.zoomWithWheel(event)
    })
    this.moveTrain(this.ctx)
  }

  drawStations(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'green';
    ctx.fillRect(this.stations.ppio.x, this.stations.ppio.y, 2, 2);
    ctx.fillRect(this.stations.opera.x, this.stations.opera.y, 2, 2);
    ctx.fillRect(this.stations.sol.x, this.stations.sol.y, 2, 2);
    ctx.fillRect(this.stations.atocha.x, this.stations.atocha.y, 2, 2);
    ctx.fillRect(this.stations.ccasal.x, this.stations.ccasal.y, 2, 2);
    ctx.strokeText('Ppio', this.stations.ppio.x, this.stations.ppio.y)
    ctx.strokeText('Opera', this.stations.opera.x, this.stations.opera.y)
    ctx.strokeText('Sol', this.stations.sol.x, this.stations.sol.y)
    ctx.strokeText('Atocha', this.stations.atocha.x, this.stations.atocha.y)
    ctx.strokeText('CCasal', this.stations.ccasal.x, this.stations.ccasal.y)
  }

  drawTrain(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'red';
    ctx.fillRect(this.train.x, this.train.y,4,4);
  }

  moveTrain(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(this.train.x, this.train.y,4,4.2);
    this.train.x = this.train.x + 5
    this.train.y = this.train.y + 5
    ctx.fillRect(this.train.x, this.train.y,4,4);
    setTimeout(() => {
      console.log('sleep');
      this.moveTrain(this.ctx);
    }, 1000);
  }
}
