import {h, div} from '@cycle/dom';

const cylinders = (count) => {
  let res = [];
  for (let i = 0; i < count; i += 1) {
    res.push(
      cylinder({x: 100, y: 300 + i * 150}));
  }
  return res;
};

const cylinder = ({x, y}) => {
  return h(
    'a-cylinder',
    {
      attrs: {
        position: `0 ${(x / 100).toFixed(2)} ${(-y / 100).toFixed(2)}`,
        radius: '0.4',
        height: '1.8',
        color: '#FFC65D'
      }
    });
};

const renderScene = ({players, height}) => {
  return h(
    'a-scene',
    {
      attrs: {
        environment: 'preset: forest',
        embedded: ''
      }
    },
    [
      ...players.map(cylinder),
      h(
        'a-entity',
        {
          attrs: {
            position: `1 ${height} 0`,
            rotation: '0 15 0'
          }
        },
        [
          h('a-camera', [
            h('a-cursor', {attrs: {color: '#FAFAFA'}})
          ])
        ])
    ]);
};

const Scene = (sources) => {
  const state$ = sources.onion.state$;
  const vdom$ = state$.map(state =>
    div(
      {attrs:
        {id: 'view-3d'}
      },
      [
        renderScene(state)
      ]));

  return {
    DOM: vdom$
  };
}

export {
  Scene
};
