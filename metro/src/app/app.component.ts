import { Component } from '@angular/core';

import { HeaderComponent } from './header/header.component';
import { TrainComponent } from './train/train.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, TrainComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'metro';
}
