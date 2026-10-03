#include "engine/Game.h"
#include "common/Logger.h"

Game::Game()
{

}

Game::~Game()
{
	// Iterate the map and delete each Board object
	for (auto& pair : game_map)
	{
		delete pair.second;
	}
	LOG_DEBUG("Game", "destructor: cleaning up boards");
}

// Creates a fresh board for room_id, replacing any stale board with that id
// (the relay only asks for rooms it doesn't have).
bool Game::create_room(std::string room_id)
{
	auto it = game_map.find(room_id);
	if (it != game_map.end())
	{
		LOG_INFO("Game", "replacing stale room " << room_id);
		delete it->second;
	}
	game_map[room_id] = new Board(room_id);
	LOG_DEBUG("Game", "room " << room_id << " created (" << game_map.size() << " active)");
	return true;
}

bool Game::delete_room(std::string room_id)
{
	try
	{
		if (game_map.find(room_id) == game_map.end())
		{
			throw("Room : " + room_id + " Does NOT Exist");
		}

		/*
		* de - allocate the Game State Space
		* erase the map entry
		*/
		delete game_map[room_id];
		game_map.erase(room_id);

		return true;
	}
	catch (const std::string& error)
	{
		LOG_WARN("Game", error);
	}

	return false;
}

bool Game::reset_room(std::string room_id)
{
	try
	{
		if (game_map.find(room_id) == game_map.end())
		{
			throw("Room : " + room_id + " Does NOT Exist");
		}

		delete game_map[room_id];

		// Initialize a new board for the room
		game_map[room_id] = new Board(room_id);

		return true;

	}
	catch (const std::string& error)
	{
		LOG_WARN("Game", error);
	}
	return false;
}