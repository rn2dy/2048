package main

import (
  "github.com/go-martini/martini"
  "github.com/gorilla/websocket"
  "net/http"
  "log"
  "os"
  "fmt"
  "strconv"
)

var (
  rooms = make([]*GameRoom, 0)
  // globaly players are users
  users = make([]*Player, 0)
)

type Player struct {
  Name string
  room *GameRoom
  wsConn *websocket.Conn
}

func (player *Player) listen() {
  go func() {
    var ws = player.wsConn
    for {
      var jsonMsg map[string]interface{}
			err := ws.ReadJSON(&jsonMsg)
      if err != nil {
        break
      }
      log.Printf("[%s] Player: %s, Msg: %v\n", jsonMsg["msgType"], player.Name, jsonMsg["msg"])
      switch jsonMsg["msgType"] {
      case "action:move":
        player.room.broadcast(player, createMessage("broadcast:move", map[string]interface{}{"from": player.Name, "direction": jsonMsg["msg"]}))
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

func (room *GameRoom) addPlayer(newPlayer *Player) {
  // create a referece to gameRoom
  newPlayer.room = room
  // create a reference to players
  room.Players = append(room.Players, newPlayer)
  // broadcast join message
  var (
    initMsg = createMessage("initialize", map[string]interface{}{"room": room})
    joinMsg = createMessage("broadcast:join", map[string]interface{}{"player": newPlayer})
  )
  room.send(newPlayer, initMsg)
  room.broadcast(newPlayer, joinMsg)

  newPlayer.listen()

  log.Printf("%v joined game room: %s\n", newPlayer, room.Id)

  // start game if room is full
  if room.MaxAllowed == len(room.Players) {
    room.broadcast(nil, createMessage("broadcast:start", struct{}{}));
  }
}

func (room *GameRoom) send(toPlayer *Player, msg interface{}) {
  toPlayer.wsConn.WriteJSON(msg)
}

func (room *GameRoom) broadcast(fromPlayer *Player, msg interface{}) {
  for _, player := range room.Players {
    if fromPlayer != nil && player.Name == fromPlayer.Name {
      continue
    } else {
      player.wsConn.WriteJSON(msg)
    }
  }
}

func (room *GameRoom) removePlayer(name string) {
  for i, p := range room.Players {
    if p.Name == name {
      room.Players = append(room.Players[:i], room.Players[i+1:]...)
      break
    }
  }
}

// startGame will broadcast to all players a room id
func (room *GameRoom) startGame() {
  log.Println("[GameRoom:" + room.Id + "] started.")
}

func main() {
  m := martini.Classic()

  m.Get("/join", func(w http.ResponseWriter, r *http.Request){
    ws, err := websocket.Upgrade(w, r, nil, 1024, 1024)
    if _, ok := err.(websocket.HandshakeError); ok {
      http.Error(w, "Not a websocket handshake", 400)
      return
    } else if err != nil {
      log.Println(err)
      return
    }

    player := r.FormValue("player")
    roomType := r.FormValue("roomType")

    // create player
    newPlayer := &Player{Name: player, wsConn: ws}
    users = append(users, newPlayer)

    // assing player to a room
    assignRoom(roomType, newPlayer)

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
