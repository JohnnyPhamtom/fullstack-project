'use strict';

require('@google-cloud/debug-agent').start();
const gameManager = require('./newGame');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
    pingTimeout: 2000,
    pingInterval: 5000
});
var session = require('express-session')({
    name: 'session',
    secret: 'things_game',
    resave: 'true',
    saveUninitialized: 'true',
    cookie: {
        maxAge: 2 * 60 * 60 * 1000
    }
    });
var bodyParser = require('body-parser');
var ios = require('socket.io-express-session');

var mustache = require('mustache');
var fs = require('fs');


// For the app being behind a front-facing proxy
app.enable('trust proxy');

// For tracking user across pages
app.use(session);

// For parsing data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Keep track of which rooms are active
// Potentially:
/* room = {
    id = roomID,
    status = {'active', 'inactive'},
    expires = 'current time + 2hrs'
    cards =[]
}*/
var roomList = [];
var roomObject = [];
var onlineUsers = [];
var roomGuesser = {};


// ON USING DATASTORE: found at https://cloud.google.com/appengine/docs/standard/nodejs/using-cloud-datastore
// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine 
const Datastore = require('@google-cloud/datastore');

//Instantiate a datastore client
const datastore = Datastore({projectId: 'fs-things'});
// From MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function randomInt(max){
    return Math.floor(Math.random() * max);
}

// Clean up inactive rooms every 30 minutes.
function cleanRooms(){
    var len = roomList.length;
    for(var i = 0; i < len; i++){
        if(roomObject[i].playerList.length === 0){
            roomObject.splice(i,1);
            roomList.splice(i,1);
        }
    }
}
setInterval(cleanRooms, (30*60*1000)); // 30mins * 60secs * 1000ms
// Create game room
async function newRoom(username, avatarUrl){
    let roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    while(roomList.includes(roomId)) // regenerate rooms until a unique ID is made
        roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    //console.log(gameManager)
    let room =new gameManager(roomId,username, avatarUrl);
    const result = await getCard();
    const entities = result[0];
    const card = entities.map( entity => `Text: ${entity.Text}`);
    room.cards = card;
    console.log(room)
    roomList.push(roomId);
    roomObject.push(room);
    //console.log('fn(newRoom):: ' + roomList);
    return roomId;
}
// Get the actual room object using a roomId
function getRoomObject(gameRoomId){
    let found =  roomObject.find(function(element){
        if(element.roomId === gameRoomId)
            return true;
        return false;
    })
    return found;
}
// this needs to be ran asynchronously
// querying at each game request would be costly and inefficient..
// Need to query for a whole deck and then randomly give out a card for repeated gameplay
async function getCard() {
    const min = 0;
    const max = 3;
    const query = datastore
    .createQuery('Card')
    .filter('Index', '>=', min)
    .filter('Index', '<', max)
    //.filter('Index', '=', randNum)
    .order('Index', {descending: true})
    .limit(10);
    return datastore.runQuery(query);
}
// Handle ajax request for data in suggestrooms
// If the query is short, we show all rooms, otherwise we only
// show relevant results
app.get('/suggestrooms',function(req,res){
    console.log(req.query);
    if(req.query.roomList.length < 3)
        res.json(roomList);
    else{
        var newList = []
        roomList.forEach(function(element){
            if(element.includes(req.query.roomList))
                newList.push(element)
        })
        res.json(newList);
    }
    res.end();
})
// Simpler front page. All it will do is serve an html page and await a form submission
app.get('/', function(req,res){
    console.log('front.html:: ' + req.sessionID);
    console.log(onlineUsers);
    let inGameSessionId = false;
    let playerInfo = undefined;
    onlineUsers.forEach(function(player) {
        if(player.userId == req.sessionID) {
            inGameSessionId = true;
            playerInfo = {
                username: player.username,
                userId: player.userId,
                roomId: player.roomId,
                message: 'You have already joined a game. Following is the player information.'
            }
        }
    });
    if(inGameSessionId) {
        // res.sendFile(__dirname + '/error.html');
        fs.readFile(__dirname + '/error.html', function(err, data) {
            res.writeHead(200, {
                'Content-Type': 'text/html'
            });
            res.write(mustache.render(data.toString(), playerInfo));
            res.end();
        });
    } else {
        //res.json({roomList: {roomList}});
        res.sendFile(__dirname + '/front.html');  
    }
});
app.get('/roomlist', function(req,res){
    res.json({roomList});
})
// home page. will need to handle user generation and new room generation.
/*
app.get('/', async function(req,res){
    try {
        const result = await getCard();
        const entities = result[0];
        const card = entities.map( entity => `Text: ${entity.Text}`);
        console.log("res: " + result);
        console.log("ents: " + entities);
        console.log("card: " + card);
        console.log(req.sessionID);
    } catch(error){
        console.log(error);
    };
    res.sendFile(__dirname + '/front.html');
});
*/

// Upon the submit POST button from the home page, we need to determine if
// the user wants to join or create a room.
// Then redirect the user to the appropriate room.
app.post('/', async function(req,res){
        console.log("onPOST:: " + req.body.username)
        console.log(req.session.username)
        if(req.body.username == '' || req.body.username == undefined){
            req.session.username = 'Player_' + Math.random().toString(36).replace('0.', '').substr(0,6); 
        } else {
            req.session.username = req.body.username;
        }
        if(req.body.avatarUrl == '' || req.body.avatarUrl == undefined){
            req.session.avatarUrl = 'https://storage.googleapis.com/studydsstore/1552259322551avatar1.jpg';
        } else {
            req.session.avatarUrl = req.body.avatarUrl;
        }
        console.log(req.body.roomId)
        try { 
        if(req.body.roomId){
            //console.log('true')
            req.params.roomId = req.body.roomId;
            let found = getRoomObject(req.body.roomId); 
            let nameExist = false;
            if(found != undefined){
                found.playerList.forEach(function(player){
                    if(player.username == req.body.username){
                        nameExist = true;
                    }
                });
                if(nameExist){
                    req.session.username = req.body.username
                        .concat('_' + Math.random().toString(36).replace('0.', '').substr(0,6));
               }
            }
        }
        else{
            //when creating a new room, we need to query data and load up the cards
            req.params.roomId = await newRoom(req.session.username, req.session.avatarUrl);
            console.log(req.params.roomId)
        }
        req.session.roomId = req.params.roomId;
        // req.session.avatarUrl = req.body.avatarUrl;
        req.session.save(); 
        console.log(`Avatar:  ${req.session.avatarUrl}`);
        res.redirect('/'+ req.params.roomId);
    }
    catch(error){
        console.log(error);
    }
})
// creates a game page.
/*
app.get('/game/', function(req,res){
    
    //console.log(roomId);
    //console.log(roomList);
    console.log(req.sessionID);
    console.log(req.session.cookie);
    res.status(200);
    res.contentType('text/html');
    res.write('room number generated: '+ roomId);
    res.end();
    //res.sendFile(__dirname + '/game.html');
});
*/
// testing for random room generation
app.get('/:roomId/', function(req,res){
    //console.log(req.params.room);
    //console.log('appget roomlist: ' + roomList);
    //console.log(req.sessionID)
    //console.log('check session: ' + req.session.roomId)

    let found = getRoomObject(req.params.roomId);
    if(found !== undefined && found.status !== 'waiting'){
        console.log('game in progress for room: ' + req.param.roomId)

        // res.redirect('/');
        fs.readFile(__dirname + '/error.html', function(err, data) {
            res.writeHead(200, {
                'Content-Type': 'text/html'
            });
            res.write(mustache.render(data.toString(), {
                username: req.session.username,
                userId: req.sessionID,
                roomId: req.params.roomId,
                message: 'You cannot join a game which is playing.'
            }));
            res.end();
        });
    } else {
        let inGameSessionId = false;
        let playerInfo = undefined;
        onlineUsers.forEach(function(player) {
            if(player.userId == req.sessionID) {
                inGameSessionId = true;
                playerInfo = {
                    username: player.username,
                    userId: player.userId,
                    roomId: player.roomId,
                    message: 'You have already joined a game. Following is the player information.'
                }
            }
        }); 
        if(inGameSessionId) {
            // res.sendFile(__dirname + '/error.html');
            fs.readFile(__dirname + '/error.html', function(err, data) {
                res.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                res.write(mustache.render(data.toString(), playerInfo));
                res.end();
            });
        } else {
            if(roomList.includes(req.params.roomId)){
                try {
                    //const result = await getCard();
                    //const entities = result[0];
                    //const card = entities.map( entity => `${entity.Text}`);
                    //console.log(card)
                    //res.status(200);
                    //res.contentType('text/html');
                    //res.write(card.toString());
                    res.sendFile(__dirname + '/game.html');
                    //res.end();
                }catch(error){
                    console.log(error);
                }
            }else {
                console.log('room not found :: ' + req.params.roomId)

                // res.redirect('/');
                fs.readFile(__dirname + '/error.html', function(err, data) {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    res.write(mustache.render(data.toString(), {
                        username: req.session.username,
                        userId: req.sessionID,
                        roomId: req.params.roomId,
                        message: 'Cannot find any room with entered room ID'
                    }));
                    res.end();
                });

                /*
                res.status(200);
                res.contentType('text/html');
                res.write('room not found: '+ req.params.roomId);
                res.end();
                */
            }
        } 
    }
});



// On user connect to game lobby?
// Handles all user connection requests and events
io.use(ios(session));
io.on('connection', function(socket){
    console.log(socket.id + ' a user connected');
    console.log("inside a socket conn:" + socket.handshake.sessionID);
    console.log('socket conn: uname:: ' + socket.handshake.session.username);
    console.log('socket conn: roomID:: ' + socket.handshake.session.roomId); 
    // ‘gameStateWait’ - allow players to enter the room    

    onlineUsers.push({
        userId: socket.handshake.sessionID,
        username: socket.handshake.session.username,
        roomId: socket.handshake.session.roomId
    });

    try{
        let found = getRoomObject(socket.handshake.session.roomId);
        let playerNames = found.getPlayerNames();
        // ADD player to the game's playerList
        if(found != undefined && found.status === 'waiting'){
            roomGuesser[socket.handshake.session.roomId] = undefined;
            
            socket.join(socket.handshake.session.roomId); // add the roomId for socket communication
            
            if(found.playerList.length === 0) // the room is empty
                found.addPlayer(socket.handshake.session.username, socket.handshake.session.avatarUrl);
            // new player
            if(!found.getPlayerNames().includes(socket.handshake.session.username)){
                found.addPlayer(socket.handshake.session.username, socket.handshake.session.avatarUrl);
                console.log('added new player: ' + socket.handshake.session.username);
            }
            else
                console.log("player: " + socket.handshake.session.username + " already in room")
               
            console.log('-------------------- playerlist --------------------')
            console.log(found.playerList);
            io.to(socket.handshake.session.roomId).emit('playerJoin', {
                username: socket.handshake.session.username,
                userId: socket.handshake.sessionID,             // <<== changed
                roomId: socket.handshake.session.roomId,        // <<== changed
                //playerList: playerNames.length == 0 ? [] : playerNames
                avatarUrl: socket.handshake.session.avatarUrl,  // <<== changed
                playerList: found.playerList, 
            });
            console.log('--------------------------------------------------')
        }
        else {
            console.log('room status: ' + found.status);
        }
    }
    catch{
        console.log("no room id yet");
    }
        //console.log('itemfound:');
    //console.log(found);

    /*
    io.emit('playerJoin', {
        username: socket.handshake.session.username,
        userId: socket.handshake.sessionID,             // <<== changed
        roomId: socket.handshake.session.roomId,         // <<== changed
        playerList: socket.handshake.session.roomId
        });
        */

    // socket.on('playerLeave', function(){
    //     try {
    //         let playerName = socket.handshake.session.username;
    //         let room = getRoomObject(socket.handshake.session.roomId)
    //         let roomNumber = socket.handshake.session.roomId;
    //         room.removePlayer(playerName)
    //         io.to(roomNumber).emit('playerLeave', {
    //           username: playerName,
    //         });
    //     }catch{
    //         console.log('failed on playerLeave');
    //     }
    // });
    // ‘answer’ - event for when the player submits their answer
    // when all players submit their answer, game state changes to guess
    // ‘gameStateGuess’ - event to change the game state and start play
    socket.on('answer', function(msg){
        console.log(msg);
        try {
            let playerName = socket.handshake.session.username;
            let room = getRoomObject(socket.handshake.session.roomId)
            let roomNumber = socket.handshake.session.roomId;
            room.playerAnswerUpdate(playerName, msg);
            room.playerStatusUpdate(playerName, 'answered');
            socket.to(roomNumber).emit('answer', {
              username: playerName,
              useranswer: msg,
            });
            if(room.playerListStatus('answered')){
                let startingPlayer = room.activePlayers[randomInt(room.activePlayers.length)];
                console.log('starting player is : ' + startingPlayer);
                io.to(roomNumber).emit('gameStateGuess', {
                    username: startingPlayer
                });
                roomGuesser[roomNumber] = startingPlayer;
            }

        }catch{
            console.log('failed on answer');
        }
    })
    // ----  EVENTS in IO  -----------------------------------------------------------------------
    // ‘guessMatch’ - event for when the CURRENT TURN player guesses correctly
    socket.on('guessMatch', function(data){
        console.log('received from client guessMatch \
            roomID ${data.roomId} \
            ${data.username} ${data.userId} \
            ==> ${data.matchedUsername} ${data.matchedUserAnswer}');
        let room = getRoomObject(data.roomId);
        room.playerOut(data.matchedUsername);
        console.log('playerOut fn: ' + data.matchedUsername);
        console.log(room);
        // ‘playerOut’’ - event for when a player is out of the round, should follow a ‘guessMatch’
        io.to(data.roomId).emit('playerOut', {
            roomId: data.roomId,
            username: data.matchedUsername,
            useranswer: data.matchedUserAnswer,
        });
        io.to(data.roomId).emit('guessMatch', {
            roomId: data.roomId,
            username: data.matchedUsername,
            useranswer: data.matchedUserAnswer,
        })
         // ‘gameStateEnd’ - event to end the game, and allow players to start next round
         // only 1 player left. aka our winner.
         if(room.activePlayers.length === 1){
             io.to(data.roomId).emit('gameStateEnd');
             room.gameStatusUpdate('end');
             room.activePlayers = [];
             roomGuesser[data.roomId] = undefined;
         }
    })
    // ‘guessMismatch’ - event for when the CURRENT TURN player guesses wrong
    //  server should notify the room which player is next
    // ‘playerTurn’ - event for everyone to know who’s turn it is to guess
    socket.on('guessMismatch', function(data){
        let room = getRoomObject(data.roomId);
        let listSize = room.activePlayers.length;
        let current = room.activePlayers.indexOf(data.username);
        let next = room.activePlayers[(current + 1) % listSize];
        io.to(data.roomId).emit('playerTurn', {
            roomId: data.roomId,
            username: next,
        });
        roomGuesser[data.roomId] = next;
    });
   
    
    // ‘newRound’ - event for everyone to know the next round has started
    // reset all players to waiting status
    socket.on('newRound', function(data){
        let room = getRoomObject(data.roomId);
        room.activePlayers = [];
        room.playerList.forEach(element => {
            room.playerStatusUpdate(element.username, 'waiting');
        });
        room.gameStatusUpdate('waiting');
        io.to(data.roomId).emit('newRound');
        roomGuesser[data.roomId] = undefined;
    });

    // ‘playerStateReady’ - event to let the server know a player is ready.
    // when all players are ready, we can start the game
    // ‘gameStart’ - event for everyone to know the game has started
    // when all players are ready, game state changes to answer
    // ‘gameStateAnswer’ - event to allow players to submit answers. No more players can join
    socket.on('playerStateReady', function(msg){
        console.log(msg);
        try {
            let playerName = socket.handshake.session.username;
            let room = getRoomObject(socket.handshake.session.roomId)
            let roomNumber = socket.handshake.session.roomId;
            room.playerStatusUpdate(playerName, 'ready');
            //console.log(room);
            io.to(roomNumber).emit('playerReady', {
                username: playerName,
                roomId: roomNumber,
                ready: true,
            })
            if(room.playerListStatus('ready')){
                console.log('ready to answer state');
                io.to(roomNumber).emit('gameStateAnswer', {
                    question: room.cards[randomInt(room.cards.length)]
                });
                room.gameStatusUpdate('playing')
            }
        }catch{
            console.log('failed on answer');
        }
    })
    // ‘playerAnswered’ - event to let the server and other players know that an answer has been submitted
    //‘playerGuessed’ - event from client to server to let the server know that player’s guess

    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
        console.log('message: ' + msg);
    });

    // moved playerLeave to socket disconnect
    socket.on('disconnect', function(){
        console.log(socket.handshake.session.username + ' : user disconnected'); 
        try {
            let playerName = socket.handshake.session.username;
            let room = getRoomObject(socket.handshake.session.roomId)
            let roomNumber = socket.handshake.session.roomId;

            onlineUsers = onlineUsers.filter(function(player) {
                if(player.userId == socket.handshake.sessionID) {
                    return false;
                } else {
                    return true;
                }
            });

            if(room !== undefined){
                room.removePlayer(playerName)
                console.log('players left in room: ' + room.getPlayerNames());
                // remove player's roomId from the session object,
                // in case they go to the home page
                socket.handshake.session.roomId = undefined;
                socket.handshake.session.save();
                io.to(roomNumber).emit('playerLeave', {
                    username: playerName,
                });
                // ‘gameStateEnd’ - if someone gets disconnected in the middle of a round, remove them
                room.playerOut(playerName)
                io.to(roomNumber).emit('playerOut', {
                    roomId: roomNumber,
                    username: playerName,
                });
                if(room.activePlayers.length <= 1 && room.status != 'waiting'){
                    io.to(roomNumber).emit('gameStateEnd');
                    room.gameStatusUpdate('waiting');
                    room.activePlayers = [];
                    // if there is only one player left, change its status to waiting regardless of 
                    // previous status.
                    room.playerList.forEach(function(player) {
                        player.status = 'waiting';
                        player.ready = false;
                    });
                }
                if(room.playerList.length === 0) {
                    console.log('the list is empty. room state changes')
                    room.gameStatusUpdate('waiting');
                }
                // after one player left, all the players' status are answered, changed current game 
                // state to guess
                if(room.playerList.length > 1 
                    && room.activePlayers.length > 1 
                    && room.playerListStatus('answered')) {
                    if(roomGuesser[roomNumber] === undefined) {
                        let startingPlayer = room.activePlayers[randomInt(room.activePlayers.length)];
                        console.log('starting player is : ' + startingPlayer);
                        io.to(roomNumber).emit('gameStateGuess', {
                            username: startingPlayer
                        });
                        roomGuesser[roomNumber] = startingPlayer;
                    }
                    else if(roomGuesser[roomNumber] == playerName) {
                        io.to(roomNumber).emit('playerTurnException', {
                            roomId: roomNumber,
                            username: room.activePlayers[randomInt(room.activePlayers.length)],
                        });
                        roomGuesser[roomNumber] = room.activePlayers[randomInt(room.activePlayers.length)]; 
                    }
                }
            }
        }
        catch{
            console.log('failed on playerLeave');
        }
    });
});
http.listen(process.env.PORT || 3000, function(){
    console.log('listening on *:' + process.env.PORT);
});