# fullstack-project
# fullstack-project
  (Basic thoughts for front-end design)

  In-game interface design:
  +-----------------------------------------------+
  |             |                                 |
  |             |                                 |
  |  Game Logo  |                                 |    <---- The list for players' answers
  |Players Info |         Players' answers        |          Avatars are displayed on the left, answers to the right
  |             |                                 |
  |             |                                 |
  |  Personal   |_________________________________|                                
  |   Points    | > ......                 | ==>> |    <---- Players' answer input (for 3 of 4 players) 
  +-----------------------------------------------+          / confirm matching (answers to players) (for the rest one player)


  Game process:
    All players should submit an answer, then randomly pick a person to start with 1 guess. If they guess right,
  then get to guess again, else the next person gets a turn. If someone matches you to your answer you're out of
  the round.
     

  Front Back end communication:
    During the first stage, one player submit an answer, frontend shall emit an event that send an object
    {playerID: '...', answer: '...'} to backend, backend stores that object into a list []. When there are 
    three object in that list, backend emits an event to frontend to indicate that it's time for second stage.

    During the second stage, the player match the answers and then send an list [{playerID, answer}, {playerID, answer}, ...]
    and compare to the previous list stored in the back end. 

  Some ideas for "Room":
    Either static or dynamic way is fine, depends on the backend implementation. Here is a little bit my ideas:
      Maintain a counter which works as a roomid generator: start at 1.
        If someone create a room, assign current id to that room and the counter increment one. 
      Maintain a list to store each room's information, in the same time, the index of the list is the roomid
      [{
        roomid: ...,
        owner: ..., // owner's id
        players: [],
        players_answers: [], // as mentioned in the first stage
        player_matched: [], // as mentioned in the second stage
        status: ..., // waiting-players || ingame 
      }]
     
  Temporary goals:
    Mar. 5th:  frontend and backend basic functionalities for one round
    Mar. 7th:  refine & valid frontend-backend data transforming
    Mar. 12nd or 14th: implement mulitple rounds & refine user interface
    Mar. 19th:  testing and validation
