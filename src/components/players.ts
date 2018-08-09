type PlayerId = number;
type Player = {
  id: PlayerId, 
  x: number, 
  y: number, 
  color: number
};

function generatePlayerId(players: Player[]): PlayerId {
  const max = players.reduce((m, p) => Math.max(m, p.id), 0);
  return max + 1;
}

function createPlayer({id, x, y, color}: {id: PlayerId, x?: number, y?: number, color?: number}): Player {
  return {
    id: id,
    x: x || 0,
    y: y || 0,
    color: color || 0
    };
}

export {
  PlayerId,
  Player,
  generatePlayerId,
  createPlayer
};
