import {h, div, span} from '@cycle/dom';

const cyclinders = (count) => {
  let res = [];
  for (let i = 0; i < count; i += 1) {
    res.push(h(
      'a-cylinder', 
      {
        attrs: {
          position: `0 1 ${-3 - i * 1.5}`,
          radius: '0.4',
          height: '1.8',
          color: '#FFC65D'
        }
      }));
  }
  return res;
};

const renderScene = (state) => h(
  'a-scene', 
  {
    attrs: {
      environment: 'preset: forest',
      embedded: ''
    }
  }, 
  [
    ...cyclinders(state.nbPlayers),
    h(
      'a-entity',
      {
        attrs: {
          position: `1 ${state.height} 0`,
          rotation: '0 15 0'
        }
      },
      [
        h('a-camera', [
          h('a-cursor', {attrs: {color: '#FAFAFA'}})
        ])
      ])
  ]);

export {
  renderScene
}
