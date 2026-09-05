# Convenience targets. See scripts/ for what they run.
#
# LOG_LEVEL is passed through to the C++ engine as CHESS_LOG_LEVEL
# and (for `build-cpp`) as the compile-time minimum (elides calls
# strictly below it, so their cost is zero at runtime).
#
#   make run                    # default INFO
#   make run LOG_LEVEL=DEBUG
#   make build-cpp LOG_LEVEL=INFO   # rebuild with compile-time floor at INFO

.PHONY: build build-cpp run deploy stop logs clean

LOG_LEVEL ?= INFO

# Numeric levels for the compile-time floor (matches Logger.h).
LOG_LEVEL_NUM_TRACE = 0
LOG_LEVEL_NUM_DEBUG = 1
LOG_LEVEL_NUM_INFO  = 2
LOG_LEVEL_NUM_WARN  = 3
LOG_LEVEL_NUM_ERROR = 4
LOG_LEVEL_NUM_FATAL = 5
LOG_LEVEL_NUM = $(LOG_LEVEL_NUM_$(LOG_LEVEL))

build:
	./scripts/build.sh $(LOG_LEVEL)

build-cpp:
	cmake -S cppServer -B cppServer/build -DCMAKE_BUILD_TYPE=Release -DCHESS_MIN_LOG_LEVEL=$(LOG_LEVEL_NUM)
	cmake --build cppServer/build -j

run:
	LOG_LEVEL=$(LOG_LEVEL) ./scripts/run.sh

deploy:
	./scripts/deploy.sh

stop:
	docker compose down

logs:
	docker compose logs -f

clean:
	rm -rf cppServer/build client/dist client/node_modules server/node_modules
