URL base: `http://localhost:8091/farkle`

### GET /farkle/games/{key}

Retrieves a game primary key

### POST /farkle/games/

Create or join a game - need information about a current state of game, if there are places left, or to create new game

### GET /farkle/games/{game-key}

I want to know who is playing in the current game

### GET /farkle/games

I want all the games I played, and how many I won.

### GET /farkle/games/current-user/{key}

I want to know whose turn it is

### POST

### /farkle/games/{game-key}/turns/{turn-key}/roll

I want to roll the currently available dice

Return the rolled dice, or Farkle.

I want to bank some scoring dice (is it easier to remove non-scoring dice from being able to be selected, or to allow users to select non-scoring dice?)

I want to roll again/or bank and end turn.

I want to know each users current score