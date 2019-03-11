'use strict';

require('@google-cloud/debug-agent').start();
const gameManager = require('./newGame');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
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

// ON USING DATASTORE: found at https://cloud.google.com/appengine/docs/standard/nodejs/using-cloud-datastore
// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine 
const Datastore = require('@google-cloud/datastore');

//Instantiate a datastore client
const datastore = Datastore();
// From MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function randomInt(max){
    return Math.floor(Math.random() * max);
}

// Create game room
function newRoom(username){
    let roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    while(roomList.includes(roomId)) // regenerate rooms until a unique ID is made
        roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    //console.log(gameManager)
    let room =new gameManager(roomId,username);
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
function getCard() {
    let randNum = randomInt(3);
    const query = datastore
    .createQuery('Card')
    .filter('Index', '=', randNum)
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
    //res.json({roomList: {roomList}});
    res.sendFile(__dirname + '/front.html');
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
app.post('/', function(req,res){
    console.log("onPOST:: " + req.body.username)
    console.log(req.session.username)
    req.session.username = req.body.username;
    console.log(req.body.roomId)
    if(req.body.roomId){
        //console.log('true')
        req.params.roomId = req.body.roomId;
    }
    else{
        //console.log('false')
        req.params.roomId = newRoom(req.body.username);
        console.log(req.params.roomId)
    }
    req.session.roomId = req.params.roomId;
    //res.status(200);
    //res.contentType('text/html');
    //res.write('room number generated: '+ JSON.stringify(req.body, null, 2));
    //res.end();
    res.redirect('/'+ req.params.roomId);
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
app.get('/:roomId/', async function(req,res){
    //console.log(req.params.room);
    //console.log(roomList);
    console.log(req.sessionID)
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
        res.redirect('/');
        /*
        res.status(200);
        res.contentType('text/html');
        res.write('room not found: '+ req.params.roomId);
        res.end();
        */
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
    try{
        let found = getRoomObject(socket.session.handshake.roomId);
        // ADD player to the game's playerList
        if(found != undefined){
            socket.join(socket.session.handshake.roomId); // add the roomId for socket communication
            console.log(found.playerList);
            found.playerList.find(function(element){
                if(element.username === socket.handshake.session.username)
                    console.log('player: ' + socket.handshake.session.username + " already in room")
                else{
                    found.addPlayer(socket.handshake.session.username);
                    console.log('added new player: ' + socket.handshake.session.username);
                }
            })
        }
    }
    catch{
        console.log("no room id yet");
    }
        //console.log('itemfound:');
    //console.log(found);

    io.emit('playerJoin', {
        username: socket.handshake.session.username,
        });
    socket.on('playerLeave', function(){
        try {
            let playerName = socket.handshake.session.username;
            let room = getRoomObject(socket.handshake.session.roomId)
            let roomNumber = socket.handshake.session.roomId;
            room.removePlayer(playerName)
            io.to(roomNumber).emit('playerLeave', {
              username: playerName,
            });
        }catch{
            console.log('failed on playerLeave');
        }
    });
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
                io.to(roomNumber).emit('gameStateGuess')
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
        room.playerOut(data.username);
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
    })
    // ‘guessMismatch’ - event for when the CURRENT TURN player guesses wrong
    //  server should notify the room which player is next
    // ‘playerTurn’ - event for everyone to know who’s turn it is to guess
    io.on('guessMismatch', function(data){
        let room = getRoomObject(data.roomId);
        let listSize = room.activePlayers.length;
        let current = room.activePlayers.indexOf(data.username);
        let next = room.activePlayers[(current + 1) % listSize];
        io.to(data.roomId).emit('playerTurn', {
            roomId: data.roomId,
            username: next,
        });
    });
   
    
    // ‘newRound’ - event for everyone to know the next round has started
    // ‘gameStateWait’ - allow players to enter the room   
    
   
    // ‘gameStateEnd’ - event to end the game, and allow players to start next round
    // when all players are ready, game state changes to answer
    // ‘gameStateAnswer’ - event to allow players to submit answers. No more players can join
    
    // ‘playerStateReady’ - event to let the server know a player is ready.
    // when all players are ready, we can start the game
    // ‘gameStart’ - event for everyone to know the game has started
    socket.on('playerStateReady', function(msg){
        console.log(msg);
        try {
            let playerName = socket.handshake.session.username;
            let room = getRoomObject(socket.handshake.session.roomId)
            let roomNumber = socket.handshake.session.roomId;
            room.playerStatusUpdate(playerName, 'ready');
            if(room.playerListStatus('ready')){
                io.to(roomNumber).emit('gameStart')
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
    socket.on('disconnect', function(){
        console.log(socket.handshake.session.username + ' : user disconnected');
    });
});
http.listen(process.env.PORT || 3000, function(){
    console.log('listening on *:' + process.env.PORT);
});