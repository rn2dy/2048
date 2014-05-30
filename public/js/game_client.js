function uuid() {
  return (""+1e7).replace(/1|0/g,function(){return(0|Math.random()*16).toString(16)});
}

function Client2048 (sock) {
  this.ws = sock;
  this.wsCallbacks = {};
  this.roomId = null;
}


// send outbound move directive
Client2048.prototype.move = function(direction){
  var dir = null;
  switch(direction) {
    case 'UP':
      dir = {x: 0, y: -1};
      break;
    case 'DOWN':
      dir = {x: 0, y: 1};
      break;
    case 'RIGHT':
      dir = {x: 1, y: 0};
      break;
    case 'LEFT':
      dir = {x: -1, y: 0};
      break;
  }

  this.broadcast("action:move", dir);
}

Client2048.prototype.broadcast = function(msgType, msg) {
  // broadcast message to other players in the same room
  this.ws.send(JSON.stringify({msgType: msgType, msg: msg}));
}

// register a callback with client
Client2048.prototype.on = function(msgType, func) {
  this.wsCallbacks[msgType] = func.bind(this);
}

Client2048.prototype.init = function(){
  // all players are read, start the game
  this.on('broadcast:start', function(msg){
    console.log("[broadcast:start]", msg);
  });

  // new player joined the room
  // this.on('broadcast:join', function(msg){
  //   console.log("[broadcast:join]", msg);
  //   var othersDiv = document.getElementsByClassName("others")[0],
  //       p = document.createElement("p");
  //   p.id = msg.player.Name;
  //   p.innerHTML = "<div>" + msg.player.Name + "</div><ul></ul>";
  //   othersDiv.appendChild(p);
  // });

  // other player made a move
  this.on('broadcast:move', function(msg){
    console.log("[broadcast:move]", msg);
    var li = document.createElement("li")
    li.innerText = JSON.stringify(msg.direction);
    var ul = document.querySelector("#" + msg.from + " ul");
    ul.appendChild(li);
  });

  // player quited
  this.on('broadcast:quit', function(msg){
    console.log("[broadcast:quit]", msg);
  });

  // happens after player joined a game
  // this.on('initialize', function(msg){
  //   console.log("[initialize]", msg);
  //
  //   var headerDiv = document.getElementsByClassName("header")[0],
  //       meDiv = document.getElementsByClassName("me")[0],
  //       othersDiv = document.getElementsByClassName("others")[0];
  //   headerDiv.innerText = "Game Room<#" + msg.room.Id + "#>" + " MaxAllowed: " + msg.room.MaxAllowed;
  //   for(var i=0; i < msg.room.Players.length; i++) {
  //     var p = document.createElement("p");
  //     if(msg.room.Players[i].Name == me){
  //       p.innerText = me;
  //       meDiv.appendChild(p);
  //     } else {
  //       p.id = msg.room.Players[i].Name;
  //       p.innerHTML = "<div>" + msg.room.Players[i].Name + "</div><ul></ul>";
  //       othersDiv.appendChild(p);
  //     }
  //   }
  // });

};

Client2048.prototype.start = function() {
  this.init()
  var self = this;
  this.ws.onmessage = function(message) {
    var m = JSON.parse(message.data);
    if(self.wsCallbacks[m.msgType]) {
      self.wsCallbacks[m.msgType](m.msg);
    } else {
      console.log('Unhandled message type: ' + m.msgType)
      console.log('Content: ');
      console.log(m.msg);
    }
  };

  this.ws.onclose = function(e) {
    alert("Connection dropped.");
  };
}
