// Records the moves played in each room so a game played by hand can be
// exported or saved as a PGN fixture.
//
// Listens to the domain events GameEngine emits (moved / undone / redone /
// promoted / started / reset). Nothing in production listens to those, so
// this is the only place the bookkeeping exists.

class MoveHistory {
  constructor(engine, rooms) {
    this.rooms = rooms;
    /** @type {Map<string, {moves: object[], undone: object[]}>} */
    this.byRoom = new Map();

    engine.on("started", ({ roomId }) => this.set(roomId, []));
    engine.on("reset",   ({ roomId }) => this.set(roomId, []));
    engine.on("moved", ({ roomId, playerId, pieceId, from, to }) => {
      const h = this._get(roomId);
      h.moves.push({ player: playerId, pieceId, from, to, promo: null });
      h.undone = [];
    });
    engine.on("promoted", ({ roomId, newPieceId }) => {
      const last = this._get(roomId).moves.at(-1);
      if (last) last.promo = newPieceId;
    });
    // The engine keeps a single level of undo/redo.
    engine.on("undone", ({ roomId }) => {
      const h = this._get(roomId);
      const m = h.moves.pop();
      if (m) h.undone.push(m);
    });
    engine.on("redone", ({ roomId }) => {
      const h = this._get(roomId);
      const m = h.undone.pop();
      if (m) h.moves.push(m);
    });
  }

  set(roomId, moves) {
    this._prune();
    this.byRoom.set(roomId, { moves: moves.slice(), undone: [] });
  }

  moves(roomId) {
    return this._get(roomId).moves.slice();
  }

  _get(roomId) {
    if (!this.byRoom.has(roomId)) this.set(roomId, []);
    return this.byRoom.get(roomId);
  }

  // Rooms are disposed when their last socket leaves; drop their history too.
  _prune() {
    for (const id of this.byRoom.keys()) if (!this.rooms.has(id)) this.byRoom.delete(id);
  }
}

module.exports = { MoveHistory };
