import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, makeDOMDriver} from '@cycle/dom';
require('aframe');
require("aframe-environment-component");

const cyclinders = (count) => {
  let res = [];
  for (let i = 0; i < count; i += 1) {
    res.push(h(
      'a-cylinder', 
      {
        attrs: {
          position: `0 1 ${-3 - i * 1.5}`,
          radius: '0.5',
          height: '1.5',
          color: '#FFC65D'
        }
      }));
  }
  return res;
};

function main(sources) {
  let vdom$ = xs.periodic(16).startWith(0).map(i =>
    h('a-scene', {attrs: {environment: 'preset: forest'}}, [
      ...cyclinders(3),
      h(
        'a-entity',
        {attrs: {position: '0 1 0'}},
        [
          h('a-camera', [
            h('a-cursor', {attrs: {color: '#FAFAFA'}})
          ])
        ])
    ])
  );

  return {
    DOM: vdom$
  };
}

Cycle.run(main, {
  DOM: makeDOMDriver('#app')
});