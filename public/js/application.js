window.onload = function(){
  var me = "Player-" + uuid(),
      ctx = me,
      roomType = 4,
      complexity = 4;

  var gameClient = new Client2048(new WebSocket('ws://localhost:3000/join?player=' + me +  '&roomType=' + roomType));
  gameClient.start();

  // set game container's class
  var gContainer = document.querySelector('.game-container')
  gContainer.className = gContainer.className + ' ' + me;

  // on initlaize do the following
  gameClient.on('initialize', function(msg){
    console.log("[initialize]", msg);
    // create the game
    new GameManager(complexity, new KeyboardInputManager, new HTMLActuator(ctx));

    // for others just render the tiles
    for(var i=0; i < msg.room.Players.length; i++) {
      var p = document.createElement("p");
      if(msg.room.Players[i].Name != me){
        var othersContainer = document.querySelector('.container-other'),
            viewboxTmpl = document.querySelector('#view-box-tmpl').innerHTML;
        viewboxTmpl.replace('_player_', msg.room.Players[i].Name);
        othersContainer.innerHTML += viewboxTmpl;
        // TODO initialize game manager for this guy
        new GameManagerSimple(complexity, new HTMLActuatorSimple());
      }
    }
  });

  gameClient.on('broadcast:join', function(msg){
    console.log("[broadcast:join]", msg);
    var othersContainer = document.querySelector('.container-other'),
        viewboxTmpl = document.querySelector('#view-box-tmpl').innerHTML;
    viewboxTmpl.replace('_player_', msg.player.Name);
    othersContainer.innerHTML += viewboxTmpl;
    // TODO initialize game manager for this guy
  });
};
