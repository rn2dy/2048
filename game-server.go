package main

import (
  "github.com/go-martini/martini"
  "github.com/gorilla/websocket"
  "net/http"
  "log"
  "os"
  "fmt"
  "html/template"
  "io/ioutil"
  "strconv"
  "strings"
)

var (
  rooms = make([]*GameRoom, 0)
  gameStates = make(map[string]interface{})
)

type Player struct {
  Id string
  Name string
  room *GameRoom
  wsConn *websocket.Conn
}

func (player *Player) listen() {
  go func() {
    var ws = player.wsConn
    defer func(){
      // notify others
      player.room.broadcast(nil, createMessage("leave", player));
      // remove game states from the player to be deleted
      delete(gameStates, player.Id)
      // delete this player from room
      log.Println("Deleting player: " + player.Name)
      var allPlayers = player.room.Players
      for i, p := range allPlayers {
        if p.Id == player.Id {
          player.wsConn.Close()
          player.room.Players = append(allPlayers[:i], allPlayers[i+1:]...)
          break;
        }
      }
    }()
    for {
      var jsonMsg map[string]interface{}
			if err := ws.ReadJSON(&jsonMsg); err != nil {
        log.Println(err)
        break
      }

      // message handlers
      switch jsonMsg["msgType"] {
      case "sync":
        player.room.broadcast(
          player,
          createMessage("sync", map[string]interface{}{
            "playerId":   player.Id,
            "playerName": player.Name,
            "gameState":  jsonMsg["msg"],
          }),
        )
        gameStates[player.Id] = jsonMsg["msg"]
        break;
      }
    }
  }()
}

// maxAllowed is the room type
type GameRoom struct {
  Id string
  MaxAllowed int
  Players []*Player
}

func createMessage(msgType string, msgBody interface{}) map[string]interface{} {
  return map[string]interface{}{
    "msgType": msgType,
    "msg": msgBody,
  }
}

func (room *GameRoom) hasPlayer(playerId string) bool {
  for _, p := range room.Players {
    if p.Id == playerId {
      return true
    }
  }
  return false
}

// when a new player joined game, need to sync all players states
func (room *GameRoom) addPlayer(newPlayer *Player) {
  // link gameRoom to player, vice versa
  newPlayer.room = room
  room.Players = append(room.Players, newPlayer)

  // sync other player with newly added player
  var initMsg = make([]interface{}, 0)
  for _, player := range room.Players {
    if gstate, ok := gameStates[player.Id]; ok {
      initMsg = append(initMsg, map[string]interface{}{
        "playerId":   player.Id,
        "playerName": player.Name,
        "gameState":  gstate,
      })
    }
  }
  room.send(newPlayer, createMessage("initialize", initMsg))

  newPlayer.listen()

  log.Printf("%v joined game room: %s\n", newPlayer, room.Id)

  // start game if room is full
  if room.MaxAllowed == len(room.Players) {
    room.broadcast(nil, createMessage("start", struct{}{}));
  }
}

func (room *GameRoom) send(toPlayer *Player, msg interface{}) {
  toPlayer.wsConn.WriteJSON(msg)
}

func (room *GameRoom) broadcast(fromPlayer *Player, msg interface{}) {
  for _, player := range room.Players {
    if fromPlayer != nil && player.Id == fromPlayer.Id {
      continue
    } else {
      player.wsConn.WriteJSON(msg)
    }
  }
}

func (room *GameRoom) removePlayer(id string) {
  panic("removePlayer pending implement")
}

func handleInternalError(w http.ResponseWriter, err interface{}) {
  log.Println(err)
  w.WriteHeader(500)
}

func main() {
  upgrader := websocket.Upgrader{
    ReadBufferSize: 1024,
    WriteBufferSize: 1024,
  }

  m := martini.Classic()

  m.Get("/multiplayer", func (w http.ResponseWriter, r *http.Request) {
    player := r.FormValue("player")
    roomType := r.FormValue("roomType")

    if (strings.Trim(player, " ") == "" || len(player) < 3 || len(player) > 10) || (roomType != "2" && roomType != "3" && roomType != "4") {
      log.Println("Hacker Attacking!")
      http.Redirect(w, r, "/", 307)
      return
    }

    data := map[string]string{
      "Player": player,
      "RoomType": roomType,
    }

    content, err := ioutil.ReadFile("public/multiplayer.html")
    if err != nil {
      handleInternalError(w, err)
      return
    }
    tmpl, err := template.New("multiplayer").Funcs(template.FuncMap{"minusOne": minusOne}).Parse(string(content))
    if err != nil {
      handleInternalError(w, err)
      return
    }
    err = tmpl.Execute(w, data)
    if err != nil {
      handleInternalError(w, err)
      return
    }
  })

  m.Get("/join", func(w http.ResponseWriter, r *http.Request){
    ws, err := upgrader.Upgrade(w, r, nil)
    if _, ok := err.(websocket.HandshakeError); ok {
      http.Error(w, "Not a websocket handshake", 400)
      return
    } else if err != nil {
      log.Println(err)
      return
    }

    // player := r.FormValue("player")
    playerId    := r.FormValue("playerId")
    playerName  := r.FormValue("playerName")
    roomType    := r.FormValue("roomType")

    // create player
    // newPlayer := &Player{Id: player, Name: player, wsConn: ws}
    newPlayer := &Player{Id: playerId, Name: playerName, wsConn: ws}

    // assing player to a room
    assignRoom(roomType, newPlayer)

  })

  m.Get("/test", func(w http.ResponseWriter, r *http.Request){
    ws, err := upgrader.Upgrade(w, r, nil)
    if _, ok := err.(websocket.HandshakeError); ok {
      http.Error(w, "Not a websocket handshake", 400)
      return
    } else if err != nil {
      log.Println(err)
      return
    }
    for {
      _, message, err := ws.ReadMessage()
      if err != nil {
        break
      }
      fmt.Println(string(message))
      ws.WriteMessage(1, message)
    }
  })
  m.Run()
}

func assignRoom(roomType string, player *Player) {
  var m int
  m, err := strconv.Atoi(roomType)
  if err != nil {
    m = 2
  }
  room := matchRoom(m)
  if room != nil {
    room.addPlayer(player)
  } else {
    // create a new room and add the player
    uuid, _ := generateUUID()
    newRoom := &GameRoom{Id: uuid, MaxAllowed: m}
    rooms = append(rooms, newRoom)
    newRoom.addPlayer(player)
  }
}

func matchRoom(maxAllowed int) *GameRoom {
  for _, r := range rooms {
    if r.MaxAllowed == maxAllowed && len(r.Players) < maxAllowed {
      return r
    }
  }
  return nil
}

func minusOne(strnum string) string {
  x, err := strconv.Atoi(strnum)
  if err != nil {
    panic(err)
  }
  return fmt.Sprintf("%d", x-1)
}

func generateUUID() (string, error) {
	f, err := os.Open("/dev/urandom")
	if err != nil {
		return "", err
	}
	b := make([]byte, 16)
	f.Read(b)
	f.Close()
  return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])[0:10], nil
}
