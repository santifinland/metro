import { Component } from '@angular/core';
import { webSocket } from "rxjs/webSocket";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'metro';

  constructor() {
    const subject = webSocket("ws://localhost:8081/ws");
    subject.subscribe(
       msg => console.log('message received: ' + JSON.stringify(msg, undefined, 4)), // Called whenever there is a message from the server.
       err => console.log(err), // Called if at any point WebSocket API signals some kind of error.
       () => console.log('complete') // Called when connection is closed (for whatever reason).
     );
  }
}
