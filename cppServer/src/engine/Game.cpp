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

bool Game::create_room(std::string room_id)
{
	try
	{
		if (game_map.find(room_id) != game_map.end())
		{
			throw("Room : " + room_id + " Already Exists");
		}
		game_map[room_id] = new Board(room_id);
		return true;
	}
	catch (const std::string& error)
	{
		LOG_WARN("Game", error);
	}
	return false;
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