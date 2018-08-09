type Player = {
  id: string, 
  x: number, 
  y: number, 
  color: number
};

function createPlayer({id, x, y, color}: {id: string, x?: number, y?: number, color?: number}): Player {
  return {
    id: id,
    x: x || 0,
    y: y || 0,
    color: color || 0
    };
}

export {
  Player,
  createPlayer
};
