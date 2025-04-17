---
title: Overview
subtitle: "Summary of project, intended users/stories; persistent data; external services."
order: 0
---

## REST endpoint documentation

GameController Endpoints
Start or Join Game
Server-relative URL: /games
Purpose: This endpoint either starts a new game or allows the user to join an existing game.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: POST
Inputs:
Payload (Request Body): No request body is expected.
Outputs:
Payload (Response Body): Returns a Game object in application/json format.
HTTP Status Codes:
200 OK: Game started or joined successfully.
500 Internal Server Error: If an error occurs during game creation or joining.
401 Unauthorized: If the user is not authenticated.
Perform Action (Freeze/Continue)
Server-relative URL: /games/{key}/actions
Purpose: This endpoint allows a player to perform an action in a game, such as freezing their score
or continuing their turn.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: POST
Inputs:
Path Variables:
key (UUID): The unique identifier of the game.
Payload (Request Body):
A RollAction object in application/json format. The RollAction object encapsulates the action the
user wants to perform.
Outputs:
Payload (Response Body): Returns a Roll object in application/json format, representing the result
of the action.
HTTP Status Codes:
200 OK: Action performed successfully.
400 Bad Request: If the RollAction is invalid or the game is in an invalid state.
404 Not Found: If the game with the given key does not exist.
500 Internal Server Error: If an error occurs during the action.
401 Unauthorized: If the user is not authenticated.
Get Game
Server-relative URL: /games/{key}
Purpose: Retrieves a specific game.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: GET
Inputs:
Path Variables:
key (UUID): The unique identifier of the game.
Outputs:
Payload (Response Body): Returns a Game object in application/json format.
HTTP Status Codes:
200 OK: Game retrieved successfully.
404 Not Found: If the game with the given key does not exist.
500 Internal Server Error: If an error occurs while retrieving the game.
401 Unauthorized: If the user is not authenticated.
🎲 UserController Endpoints
Get Current User
Server-relative URL: /users/me
Purpose: Retrieves the currently authenticated user's information.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: GET
Inputs:
There are no inputs for this endpoint
Outputs:
Payload (Response Body): Returns the current User object in application/json format.
HTTP Status Codes:
200 OK: User retrieved successfully.
500 Internal Server Error: If an error occurs while retrieving the user.
401 Unauthorized: If the user is not authenticated.
Update Current User
Server-relative URL: /users/me
Purpose: Updates the currently authenticated user's information.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: PUT
Inputs:
Payload (Request Body):
A User object in application/json format containing the updated user information.
Outputs:
Payload (Response Body): Returns the updated User object in application/json format.
HTTP Status Codes:
200 OK: User updated successfully.
400 Bad Request: If the provided user data is invalid.
500 Internal Server Error: If an error occurs during the update.
401 Unauthorized: If the user is not authenticated.
Get User by External Key
Server-relative URL: /users/{externalKey}
Purpose: Retrieves a user by their external key.
Access Control:
Authentication is required.
No specific roles are required.
HTTP Method: GET
Inputs:
Path Variables:
externalKey (UUID): The external key of the user to retrieve.
Outputs:
Payload (Response Body): Returns a User object in application/json format.
HTTP Status Codes:
200 OK: User retrieved successfully.
404 Not Found: If the user with the given externalKey does not exist.
500 Internal Server Error: If an error occurs while retrieving the user.
401 Unauthorized: If the user is not authenticated.
Key Points

We might want to add details about how authentication is handled.
Error Handling: expand on this to document specific error responses API might return (e.g., custom
error codes or messages).
Media Type: application/json is the media type for request and response bodies,
which is standard for REST APIs.

