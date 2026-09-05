# --- C++ chess engine image ---
# Multi-stage: builds with cmake+g++, ships in a small runtime image.

FROM debian:12-slim AS build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      pkg-config \
      libboost-system-dev \
      libboost-dev \
      nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
# The compile-time floor for logs; overridden at build:
#   docker build --build-arg CHESS_MIN_LOG_LEVEL=2 .
ARG CHESS_MIN_LOG_LEVEL=0
RUN cmake -S . -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCHESS_MIN_LOG_LEVEL=${CHESS_MIN_LOG_LEVEL} && \
    cmake --build build -j"$(nproc)"

FROM debian:12-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      libboost-system1.74.0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/build/chess_engine /app/chess_engine
ENV CHESS_ENGINE_PORT=5000
ENV CHESS_LOG_LEVEL=INFO
EXPOSE 5000
CMD ["/app/chess_engine"]
