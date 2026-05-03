import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
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
    provideAnimations(),
  ],
}).catch(err => console.error(err));
