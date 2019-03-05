'use strict';

require('@google-cloud/debug-agent').start();

var http = require('http')
  , path = require('path')
  , express = require('express')
  , bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , methodOverride = require('method-override')
  , expressSession = require('express-session')
  , app = express();

var myCookieParser = cookieParser('secret');
var sessionStore = new expressSession.MemoryStore();

// For the app being behind a front-facing proxy
app.enable('trust proxy');

// For tracking user across pages
/*
app.use(session({
    name: 'session',
    secret: 'things_game',
    resave: 'false',
    saveUninitialized: 'false',
    cookie: {
        maxAge: 2 * 60 * 60 * 1000
    }
}));
*/

// For parsing data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(methodOverride());
app.use(myCookieParser);
app.use(expressSession({ secret: 'secret', store: sessionStore }));

var server = http.Server(app)
  , io = require('socket.io')(server);

var SessionSockets = require('session.socket.io')
  , sessionSockets = new SessionSockets(io, sessionStore, myCookieParser);

// Keep track of which rooms are active
// Potentially:
/* room = {
    id = roomID,
    status = {'active', 'inactive'},
    expires = 'current time + 2hrs'
    cards =[]
}*/
var roomList = [];

// session id matches username
let onlineUsers = [];

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
    console.log(req.body.roomId)
    console.log(`********   ${req.sessionID}`)
    if(req.body.roomId){
        console.log('true')
        req.params.roomId = req.body.roomId;
    }
    else{
        console.log('false')
        req.params.roomId = newRoom();
    }
    // temp
    // if this userid exists in the list, update username and room
    /*onlineUsers[req.session] = {
        userid: req.session,
        username: req.body.username,
        room: req.params.roomId
    };*/

    res.redirect(`/${req.params.roomId}/${req.body.username}`)

    //res.status(200);
    //res.contentType('text/html');
    //res.write('room number generated: '+ JSON.stringify(req.body, null, 2));
    //res.end();
    
    // <  temporary comment out  >
    // res.redirect('/'+ req.params.roomId);
});
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

app.get('/:roomId/:username', async function(req,res){
    //console.log(req.params.room);
    //console.log(roomList);
    console.log(req.sessionID)
    if(roomList.includes(req.params.roomId)){
        try {
            const result = await getCard();
            const entities = result[0];
            const card = entities.map( entity => `${entity.Text}`);
            console.log(card)
            //res.status(200);
            //res.contentType('text/html');
            //res.write(card.toString());

            //res.end();
            req.session.roomId = req.params.roomId;
            req.session.username = req.params.username;

            res.sendFile(__dirname + '/game.html')
        }catch(error){
            console.log(error);
        }
        
    }else {
        console.log('room not found :: ' + req.params.roomId)
        res.redirect('/');
        
        //res.status(200);
        //res.contentType('text/html');
        //res.write('room not found: '+ req.params.roomId);
        //res.end();
        
    }
});

// On user connect to game lobby?
// Handles all user connection requests and events
sessionSockets.on('connection', function(err, socket, session){
    socket.emit('session', session);

    console.log(socket.id + ' a user connected');
    socket.on('user connection', function(data) {
        console.log(`........... ${data.username}`);
    });

    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
        console.log('message: ' + msg);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});
server.listen(process.env.PORT || 8080, function(){
    console.log('listening on *:' + process.env.PORT);
});