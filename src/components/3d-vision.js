import {h, div} from '@cycle/dom';

const verticalLine = (x) => h(
  'a-box',
  {
    attrs: {
      position: `${x} 0 0`,
      color: 'white',
      depth: 50,
      height: 0.5,
      width: 0.1
    }
  });

const horizontalLine = (y) => h(
  'a-box',
  {
    attrs: {
      position: `0 0 ${y}`,
      color: 'white',
      depth: 0.1,
      height: 0.5,
      width: 17
    }
  });

const drawField = () => [
  // Lateral bands
  verticalLine(-9),
  verticalLine(9),
  // front/back bands
  horizontalLine(-25),
  horizontalLine(-20),
  horizontalLine(20),
  horizontalLine(25)
];

const cylinder = ({x, y}) => {
  return h(
    'a-cylinder',
    {
      attrs: {
        position: `${(x / 25).toFixed(2)} 0.9 ${(-y / 25).toFixed(2)}`,
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
      ...drawField(),
      ...players.map(cylinder),
      h(
        'a-entity',
        {
          attrs: {
            position: `0 ${height} 0`,
            rotation: '0 0 0'
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
