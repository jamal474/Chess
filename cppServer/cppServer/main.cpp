#include <iostream>
#include <string>
#include <boost/asio.hpp>
#include <stdexcept>
#include "server.h"
#include "Conn_handler.h"

namespace asio = boost::asio;
namespace ip = asio::ip;
using namespace nlohmann;

int main(int argc, char* argv[])
{

    try
    {
        asio::io_context io_context;
        Server server(io_context, 5000);
        io_context.run();
    }
    catch (std::exception& e)
    {
        std::cerr << e.what() << std::endl;
    }
    return 0;
}


//#include<iostream>
//#include<nlohmann/json.hpp>
//
//using namespace nlohmann;
////example structure of data
//struct userMove
//{
//    int id;
//    std::string chessPiece;
//    std::pair<int, int> newPosition;
//};
//
//int main()
//{
//    // 1)converting our struct/class etc. to json
//    userMove move = { 0,"Queen",std::make_pair(4,6) };
//    json json_data = {
//        {"id",move.id},
//        {"chessPiece",move.chessPiece},
//        {"newPosition",move.newPosition}
//    };
//    std::cout << json_data.dump(1);
//    /*
//    above cout prints the following-->
//        {
//         "chessPiece": "Queen",
//         "id": 0,
//         "newPosition": [
//          4,
//          6
//         ]
//        }
//    */
//
//    std::cout << std::endl << std::endl;
//
//    // 2) reading json string back to struct.
//
//    std::string jsonString = json_data.dump(1);
//    std::cout << jsonString << std::endl;
//    json readJson = json::parse(jsonString);
//
//    userMove readMove;
//    readMove.id = readJson["id"];
//    readMove.chessPiece = readJson["chessPiece"];
//    readMove.newPosition = readJson["newPosition"];
//
//    std::cout << readMove.id << std::endl;
//    std::cout << readMove.chessPiece << std::endl;
//    std::cout << readMove.newPosition.first << std::endl;
//    std::cout << readMove.newPosition.second << std::endl;
//    return 0;
//}