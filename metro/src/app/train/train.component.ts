import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';


@Component({
  selector: 'app-train',
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit {
  @ViewChild('canvas', {static: false, read: ElementRef}) canvas!: ElementRef;
  public context!: CanvasRenderingContext2D;

  constructor() {
  }

  ngAfterViewInit(): void {
    this.context = this.canvas.nativeElement.getContext('2d');
    this.context.fillStyle = 'green';
    this.context.fillRect(10, 10, 150, 100);
  }
}
