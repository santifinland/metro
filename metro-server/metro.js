const { WebSocketServer } = require('ws');


const wb = new WebSocketServer({ port: 8081 });
wb.on('connection', function connection(wb) {
  wb.on('message', function incoming(message) {
    console.log('received: %s', message);
    wb.send(message);
  });
});

// Start the server on port 3000
console.log('Node websocket server running on port 8081');