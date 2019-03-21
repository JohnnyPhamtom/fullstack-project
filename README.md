# fullstack-project

### Our app URL:   
***
https://fs-things.appspot.com

### Build
***
``` 
    npm install  
    npm start 
```
or

``` 
    npm install  
    node server.js
```


### Our app is deployed on Google Cloud Platform
***
The program uses Google Cloud Platform's DataStore, and such you will need access to your own DataStore to run it locally.  
DataStore contains the actual text prompts a user would see when playing a game.

<br>

### Game process
***
At the main page:
* Select an icon by clicking on the empty box on the right.  
* Type in a player name.  
* Either create a new room by leaving room id blank, or type in the room id to join.  
* With 2 or fewer inputs, all rooms will be displayed as a list.  

<br>

### In game page:
***
At the main page:
* Click "Ready" on the left-hand side.  
* When all players in the room click "Ready", a question prompt will display under the player box.
* Answer the question by typing in the text box at the bottom of the page and click "Enter".
* When all players submit and answer, the game state changes to guessing.
* 1 player will try to match the opponents' answers to the author.
* To guess an answer, click on the icon of the player and the answer.
* The bottom box's text will update to show [player] said [answer] (match).
* Click on the "match" button to submit your guess.
* On success, the player continues and that opponent is out of the round.
* On failure, the next player gets a turn.
* Game continues until only 1 player is left.

