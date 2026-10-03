#pragma once
#include <map>
#include <string>
#include "engine/Board.h"

class Game
{
public:
	std::map<std::string, Board* > game_map;

	Game(); //Constructor
	~Game(); // Destructor
	
	bool create_room(std::string);
	bool delete_room(std::string);
	bool reset_room(std::string);

	// The room's board, or nullptr if there is no such room.
	Board *operator[](const std::string& room_id)
	{
		auto it = game_map.find(room_id);
		return it == game_map.end() ? nullptr : it->second;
	}
};


