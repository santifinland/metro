import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { AppComponent } from './app/app.component';
import { TrainComponent } from './app/train/train.component';
import { DebugComponent } from './app/debug/debug.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter([
      { path: '',      component: TrainComponent },
      { path: 'debug', component: DebugComponent },
    ]),
    provideHttpClient(),
    provideAnimationsAsync(),
  ],
}).catch(err => console.error(err));
