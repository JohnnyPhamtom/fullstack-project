'use strict';

require('@google-cloud/debug-agent').start();

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
// For the app being behind a front-facing proxy
app.enable('trust proxy');

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

// this needs to be ran asynchronously
function getCard() {
    let randNum = randomInt(3);
    const query = datastore
    .createQuery('Card')
    .filter('Index', '=', randNum)
    .order('Index', {descending: true})
    .limit(10);
    return datastore.runQuery(query);
}
// home page. will need to handle user generation and new room generation.
app.get('/', async function(req,res){
    try {
        const result = await getCard();
        const entities = result[0];
        const card = entities.map( entity => `Text: ${entity.Text}`);
        console.log("res: " + result);
        console.log("ents: " + entities);
        console.log("card: " + card);
    } catch(error){
        console.log(error);
    };
    res.sendFile(__dirname + '/index.html');
});

// creates a game page.
app.get('/game/', function(req,res){
    let room = Math.random().toString(36).replace('0.', '').substr(0,6);
    roomList.push(room);
    console.log(room);
    console.log(roomList);
    res.status(200);
    res.contentType('text/html');
    res.write('room number generated: '+ room);
    res.end();
    //res.sendFile(__dirname + '/game.html');
});

// testing for random room generation
app.get('/game/:room/', function(req,res){
    console.log(req.params.room);
    console.log(roomList);
    if(roomList.includes(req.params.room)){
        res.status(200);
        res.contentType('text/html');
        res.write('welcome to the random room..\n' + req.params.room);
        res.end();
    }else {
        res.status(200);
        res.contentType('text/html');
    res.write('room not found: '+ req.params.room);
    res.end();
    }
});

// on user connect.
io.on('connection', function(socket){
    console.log(socket.id + ' a user connected');
    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
        console.log('message: ' + msg);
    });
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});
http.listen(process.env.PORT || 3000, function(){
    console.log('listening on *:' + process.env.PORT);
});