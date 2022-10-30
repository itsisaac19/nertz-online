const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const compression = require('compression');

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('1234567890abcdef', 5);
const betterNanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 14);

const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, update, get } = require('firebase/database');

const firebaseConfig = {
    apiKey: "AIzaSyB4zyZHcYJuWTVxqQ8z2J5akfvV6tLVPHo",
    authDomain: "nertz-app.firebaseapp.com",
    projectId: "nertz-app",
    storageBucket: "nertz-app.appspot.com",
    messagingSenderId: "855579066920",
    appId: "1:855579066920:web:5b7945b0909f46040d2b1d",
    measurementId: "G-Y31Z46CFJN",
    databaseURL: "https://nertz-app-default-rtdb.firebaseio.com/",
};
// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const { Server } = require("socket.io");
const io = new Server(server);

app.use(compression());


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/production-inline.html');
});
app.get('/hero-video-min.mp4', (req, res) => {
  res.sendFile(__dirname + '/client/hero-video-min.mp4');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('first', (msg) => {
    console.log('message: ' + msg);
  });

  // Create party
  socket.on('create-party', () => {
    let code = nanoid();
    socket.join(code);

    let shortName = uniqueNamesGenerator({
      dictionaries: [colors, animals], // colors can be omitted here as not used
      length: 2,
      separator: '-'
    });

    socket.emit('create-party-success', {
      code,
      shortName
    })

    // Set unique game ID
    let uid = betterNanoid()
    let updateGameData = set(ref(database, `users/rooms/${code}/id`), uid).then(() => {
      console.log('set game UID to', uid)
    });
  })

  // Join party (room)
  socket.on('join-party', (data) => {
    let roomAttemptingToJoin = io.sockets.adapter.rooms.get(data.code);
    if (roomAttemptingToJoin) {
        if (Array.from(roomAttemptingToJoin).length >= 3) {
            socket.emit('full-room')
            return console.log('Room is full!')
        };

        let shortName = uniqueNamesGenerator({
            dictionaries: [colors, animals], // colors can be omitted here as not used
            length: 2,
            separator: '-'
        });
        socket.emit('short-name', shortName)
        console.log('joining room: ', data.code)
        socket.join(data.code)
    } else {
        socket.emit('invalid-code')
    }
  })

  // Game settings
  socket.on('game-settings-change', (data) => {
    console.log('game settings were changed', data);
    let room = Array.from(socket.rooms)[1];

    if (data.isStartingGame == true) {
        let clean = data; 
        //let {isStartingGame, ...clean} = data; 
        console.log('saving settings to database')
        set(ref(database, `users/rooms/${room}/settings`), clean);
    } else {
        socket.to(room).emit('game-settings-change', data)
    }
  });

  socket.on('set-game-data', async (data) => {
    let room = Array.from(socket.rooms)[1];
    let res = await update(ref(database, `users/rooms/${room}/data`), data);
    console.log('saved / updated game data', res)
  })

  socket.on('get-game-data', async (sid) => {
    let room = Array.from(socket.rooms)[1];
    let res = await get(ref(database, `users/rooms/${room}/data`));
    let snapshot = res.exists() ? res.val() : null;
    console.log('sending snapshot back to user', snapshot)
    socket.emit('send-game-data', snapshot);
  })
  // Ready states
  socket.on('send-ready-state', (data) => {
    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('send-ready-state', data);
  })

  // Leave party
  socket.on('leave-party', () => {
    let userRooms = Array.from(socket.rooms);
    let room = userRooms[1];
    socket.leave(room);
  })

  // Player names
  socket.on('player-name-change', (data) => {
    console.log('player name change:', data)

    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('player-name-change', data);
  })

  // Initial "grab"
  socket.on('my-data', (data) => {
    console.log('got data from player', {
        to: data.recipientId,
        from: data.senderId
    })
    socket.to(data.recipientId).emit('my-data', data);
  });

  // Initial "send"
  socket.on('my-initial-piles', (data) => {
    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('my-initial-piles', data);
  });

  // Work piles
  socket.on('work-pile', (data) => {
    console.log('work pile movement:', data);

    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('work-pile', data);
  });

  // Nertz piles
  socket.on('nertz-pile', (data) => {
    console.log('nertz pile change:', data);

    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('nertz-pile', data);
  });

  // Foundations
  socket.on('foundation-stack', (data) => {
    console.log('foundation change:', data);
    
    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('foundation-stack', data);
  });

  // Leave (disconnect)
  socket.on('disconnecting', () => {
    console.log('user disconnecting', socket.rooms);

    let userRooms = Array.from(socket.rooms);
    let room = userRooms[1];

    if (room) {
      io.to(room).emit('leave', {
        id: userRooms[0],
        roomIds: Array.from(io.sockets.adapter.rooms.get(room)),
      });
    }
  });


  // Start
  socket.on('start-game', () => {
    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('start-game');
  });


  // Scoring !!! 
  socket.on('win', async (data) => {
    let whoWon = data.id;
    let room = Array.from(socket.rooms)[1];
    io.to(room).emit('round-end')

    let roundData = await set(ref(database, `users/rooms/${room}/${data.round}/data`), {
      winner: data.id,
      timeElapsed: data.timeElapsed,
    });
    console.log('saved ROUND data', {
      winner: data.id,
      timeElapsed: data.timeElapsed,
    })

    let updateGameData = await update(ref(database, `users/rooms/${room}/data`), {
      state: 'paused',
      timeOfStart: null,
      round: parseInt(data.round) + 1
    });
    console.log(`updated GAME data`, {
      state: 'paused',
      timeOfStart: null,
      round: parseInt(data.round) + 1
    })

    // Check for limits:
    
    let res = await get(ref(database, `users/rooms/${room}`));
    let roomData = res.exists() ? res.val() : null;
    let settings = roomData.settings;
    
    let latestRoundData = roomData[parseInt(data.round)]
    const { gameData, ...playerData } = latestRoundData;
    let isOverPointsThreshold = false;
    let isOverRoundsThreshold = false;
    let shouldEndMatch = false;

    if (settings.pointsChecked == true) {
      let pointsThreshold = settings.pointsThreshold;

      Object.keys(playerData).forEach(playerId => {
          if (playerData[playerId].score > pointsThreshold) {
            isOverPointsThreshold = true;
          }
      })
    }
    if (settings.roundsChecked == true) {
      isOverRoundsThreshold = (parseInt(data.round) + 1) > settings.roundsThreshold;
    }
  
    if (isOverPointsThreshold || isOverRoundsThreshold) {
      console.warn('over threshold:', {
        isOverPointsThreshold,
        isOverPointsThreshold
      });
      shouldEndMatch = true;
    }

    io.to(room).emit('next-round', {
      players: Array.from(io.sockets.adapter.rooms.get(room)),
      roomData,
      shouldEndMatch
    });
    console.log('populating next round piles')
  })

  
  socket.on('next-round', (data) => {
    let room = Array.from(socket.rooms)[1];
    io.to(room).emit('next-round', {
        players: Array.from(io.sockets.adapter.rooms.get(room))
    });
  });

  socket.on('round-data', (data) => {
    console.log('Received round data:', data);
    let room = Array.from(socket.rooms)[1];
    socket.to(room).emit('player-stats', data);

    set(ref(database, `users/rooms/${room}/${data.round}/${socket.id}`), {
        score: data.score,
        cardsPlayed: data.cardsPlayed
    });

  })

});

io.of("/").adapter.on("join-room", (room, id) => {
  if (room !== id) {
    console.log(`socket ${id} has joined room: ${room} with players:`, io.sockets.adapter.rooms.get(room));
    io.to(room).emit('join', {
      players: Array.from(io.sockets.adapter.rooms.get(room)),
      roomCode: room,
    });
  }
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});


