'use strict';

require('@google-cloud/debug-agent').start();

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
function newRoom(){
    let roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    while(roomList.includes(roomId)) // regenerate rooms until a unique ID is made
        roomId = Math.random().toString(36).replace('0.', '').substr(0,6);
    roomList.push(roomId);
    console.log('fn(newRoom):: ' + roomList);
    return roomId;
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
        console.log('true')
        req.params.roomId = req.body.roomId;
    }
    else{
        console.log('false')
        req.params.roomId = newRoom();
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

    io.emit('playerJoin', {
        username: socket.handshake.session.username,
        userId: socket.handshake.sessionID, 
        roomId: socket.handshake.session.roomId 
    });

    socket.on('playerJoin', function(data) {
        console.log(`Received from client playerJoin ${data.username} ${data.roomId}`);
    });

    socket.on('answer', function(data) {
        console.log(`Received from client answer ${data.username}  ${data.answer}`);
        io.emit('answer', data);
    });

    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
        console.log('message: ' + msg);
    });
    socket.on('disconnect', function(){
        console.log('user disconnected');

        if(socket.handshake.session.username !== undefined 
           && socket.handshake.session.roomId !== undefined) {
            io.emit('playerLeave', {
                username: socket.handshake.session.username,
                userId: socket.handshake.sessionID, 
                roomId: socket.handshake.session.roomId 
            });
        }
    });
});
http.listen(process.env.PORT || 3000, function(){
    console.log('listening on *:' + process.env.PORT);
});