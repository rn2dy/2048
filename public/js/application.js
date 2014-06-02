window.onload = function(){
  // create backdrop
  var waitMsg = document.querySelector('#countdown .wait-msg'),
      waitMsgJoinedCount = document.querySelector('#countdown .wait-msg .joined-count'),
      backdrop = document.querySelector('#backdrop');

  backdrop.style.display = 'block';

  // TODO refactor variable name!!
  var playerName = document.querySelector('#init-data').getAttribute('data-player'),
      roomType = document.querySelector('#init-data').getAttribute('data-room-type'),
      myId = "pid_" + (""+1e7+1e5).replace(/1|0/g,function(){return(0|Math.random()*16).toString(16)}),
      complexity = 4,
      numOfPlayersJoined = 1,
      othersGameManager = {},
      bestContainer = document.querySelector('.best-container'),
      wsConnectionUri = 'ws://' + window.location.host + '/join?playerName=' + playerName + '&playerId=' + myId +  '&roomType=' + roomType;

  // set my game container's class
  var gContainer = document.querySelector('.game-container');
  gContainer.className = gContainer.className + ' ' + myId;

  var gameManager = new GameManager(
                      complexity,
                      new KeyboardInputManager,
                      new HTMLActuator(myId),
                      new Client2048(wsConnectionUri),
                      bestContainer
                    );

  // sync other players' state when either the player joined the room or the player made a move
  gameManager.on('sync', function(msg){
    var playerId = msg.playerId;
    if(!othersGameManager[playerId]){
      // render the grid for the first time
      var othersContainer = document.querySelector('.container-other'),
          viewboxTmpl = document.querySelector('#view-box-tmpl').innerHTML;
      viewboxTmpl = viewboxTmpl.replace('_player_id_', playerId).replace('_player_name_', msg.playerName);
      // othersContainer.innerHTML += viewboxTmpl;
      othersContainer.appendChild(buildHTML(viewboxTmpl));

      // create a gameManager
      othersGameManager[playerId] = new GameManagerSimple(complexity, new HTMLActuatorSimple(playerId), bestContainer);
      numOfPlayersJoined++;
      waitMsgJoinedCount.innerText = (roomType - numOfPlayersJoined) + '';
    }
    othersGameManager[playerId].setState(JSON.parse(msg.gameState));
  });

  gameManager.on('leave', function(msg){
    var playerId = msg.Id;
    console.log('deleting: ' + msg.Name)
    document.querySelector('.view-box.' + playerId).remove();
    delete othersGameManager[playerId];
    numOfPlayersJoined--;
    waitMsgJoinedCount.innerText = (roomType - numOfPlayersJoined) + '';
  });

  gameManager.on('initialize', function(players){
    for(var i=0; i<players.length; i++){
      var playerId = players[i].playerId,
          playerName = players[i].playerName,
          gameState = players[i].gameState;
      // render the grid for the first time
      var othersContainer = document.querySelector('.container-other'),
          viewboxTmpl = document.querySelector('#view-box-tmpl').innerHTML;
      viewboxTmpl = viewboxTmpl.replace('_player_id_', playerId).replace('_player_name_', playerName);
      othersContainer.appendChild(buildHTML(viewboxTmpl));
      // othersContainer.appendChild(_.template(viewboxTmpl, {playerId: playerId, playerName: playerName}))

      // create a gameManager and sync game state
      othersGameManager[playerId] = new GameManagerSimple(complexity, new HTMLActuatorSimple(playerId), bestContainer);
      othersGameManager[playerId].setState(JSON.parse(gameState));
      numOfPlayersJoined++;
      waitMsgJoinedCount.innerText = (roomType - numOfPlayersJoined) + '';
    }
  });

  gameManager.on('start', function(){
    waitMsg.style.display = 'none';

    setTimeout(function(){
      var countDownNum = document.querySelector('#countdown .count'),
          ctMsg = document.querySelector('#countdown .ct-msg'),
          countDown = document.querySelector('#countdown');

      ctMsg.style.display = 'block';
      countDown.style.display = 'block';

      var countdownTimer = null;
      countdownTimer = setInterval(function(){
        var ct = parseInt(countDownNum.innerText) - 1;
        countDownNum.innerText = ct >= 0 ? ct + '' : '0';
        if(ct == -1) {
          clearInterval(countdownTimer);
          backdrop.style.display = 'none';
          countDown.style.display = 'none';
          gameManager.unlock();
          startTimer();
        }
      }, 1000);
    }, 1000);
  });

};

var parser = new DOMParser();

// A super simple dom tree builder
// take string and build a dom tree out of it
function buildHTML(html) {
  var doc = parser.parseFromString(html, "text/html");
  return doc.querySelector('body').childNodes[0];
}

// A super simple timer
function startTimer(){
  var hoursLabel   = document.getElementById("hours");
  var minutesLabel = document.getElementById("minutes");
  var secondsLabel = document.getElementById("seconds");
  var totalSeconds = 0;
  setInterval(setTime, 1000);

  function setTime(){
    ++totalSeconds;
    secondsLabel.innerHTML = pad(totalSeconds%60);
    minutesLabel.innerHTML = pad(parseInt(totalSeconds/60));
    hoursLabel.innerHTML = pad(parseInt(totalSeconds/3600));
  }

  function pad(val){
    var valString = val + "";
    if(valString.length < 2){
      return "0" + valString;
    } else {
      return valString;
    }
  }
}
