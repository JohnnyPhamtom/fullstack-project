// Manage the game state inside a single object

class ThingsGame {
    constructor(roomId, name, url){
        this.roomId = roomId;
        this.status = 'waiting';
        this.owner = name;
        this.playerList = [];
        var player = {username: name, status: 'waiting', answer: '', avatar: url, ready: false};
        this.playerList.push(player);
        this.activePlayers = [];
        this.cards = [];
    }
    // update game status
    // when the game starts, create get all player names as activePlayers
    gameStatusUpdate(status){
        this.status = status;
        if(this.status === 'playing')
            this.playerList.forEach(element =>
                this.activePlayers.push(element.username)
                )
    }
    // add players
    addPlayer(name, url){
        var player = {username: name, status: 'waiting', answer: '', avatar: url, ready: false};
        this.playerList.push(player);
    }
    // remove players
    removePlayer(name){
        var pos;
        this.playerList.forEach(element => {
            if(element.username === name)
                pos = this.playerList.indexOf(element);
        })
        if(pos !== undefined)
            this.playerList.splice(pos,1);
    }
    // get all player names
    getPlayerNames(){
        var playerNames = [];
        this.playerList.forEach(element =>
            playerNames.push(element.username));
        return playerNames;
    }
    // update player status
    playerStatusUpdate(name,status){
        this.playerList.forEach(element => {
            if(element.username === name)
                element.status = status;
        })
    }
    // update player answer
    playerAnswerUpdate(name,answer){
        this.playerList.forEach(element => {
            if(element.username === name)
                element.answer = answer;
        })
    }
    // check that all players status is the same
    playerListStatus(status){
        let check = true;
        this.playerList.forEach(element => {
            if(element.status !== status)
                check = false;
        })
        return check;
    }
    // check player answer, return 1 for match, 0 otherwise
    checkGuess(target,answer){
        var  result = 0;
        this.playerList.forEach(element => {
            // matching both the name and answer
            if((element.username === target) && (element.answer === answer))
                result = 1;
        })
        return result | 0;
    }
    // remove player from current round
    playerOut(name){
        var pos;
        this.activePlayers.forEach(element => {
            if(element === name)
                pos = this.activePlayers.indexOf(element);
            
        })
        console.log('in playerOutfn:' + pos);
        if(pos !== undefined)
            this.activePlayers.splice(pos,1);

    }

}

module.exports =ThingsGame;