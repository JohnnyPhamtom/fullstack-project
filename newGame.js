// Manage the game state inside a single object

class ThingsGame {
    constructor(roomId, name){
        this.roomId = roomId;
        this.status = 'waiting';
        this.owner = name;
        this.playerList = [];
        var player = {username: name, status: 'waiting', answer: ''};
        this.playerList.push(player);
    }
    // update game status
    gameStatusUpdate(status){
        this.status = status;
    }
    // add players
    addPlayer(name){
        var player = {username: name, status: 'waiting', answer: ''};
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
}