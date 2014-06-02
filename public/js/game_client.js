function Client2048 (wsHost) {
  this.ws = null;
  this.wsHost = wsHost;
  this.wsCallbacks = {};
  this.onOpenCallback = null;
}

Client2048.prototype.afterOpen = function(func) {
  this.onOpenCallback = func;
};

// broadcast message to other players in the same room
Client2048.prototype.broadcast = function(msgType, msg) {
  this.ws.send(JSON.stringify({msgType: msgType, msg: msg}));
}

// callback registered here will handle events from server
Client2048.prototype.on = function(msgType, func) {
  this.wsCallbacks[msgType] = func.bind(this);
}

Client2048.prototype.listen = function() {
  var self = this;
  this.ws.onopen = function(){
    self.ws.onmessage = function(message) {
      var m = JSON.parse(message.data);
      if(self.wsCallbacks[m.msgType]) {
        self.wsCallbacks[m.msgType](m.msg);
      } else {
        console.log('Unhandled message type: ' + m.msgType)
        console.log('Content: ', m.msg);
      }
    };
    self.onOpenCallback && self.onOpenCallback();
  }
  this.ws.onclose = function(e) {
    alert('Connection dropped!');
  };
  this.ws.onerror = function(e) {
    console.log(e)
  }
};

Client2048.prototype.connect = function() {
  // create the connection
  this.ws = new WebSocket(this.wsHost);
  this.listen();
}
