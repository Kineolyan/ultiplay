import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, makeDOMDriver} from '@cycle/dom';
require('aframe');

function main(sources) {
  let vdom$ = xs.periodic(16).startWith(0).map(i =>
    h('a-scene', [
      h('a-sphere', {
        attrs: {
          position: `0 ${i / 100} -1`,
          radius: '1.25',
          color: '#EF2D5E'
        }
      }),
      h('a-box', {
        attrs: {
          position: '-1 0.5 1',
          rotation: '0 45 0',
          width: '1',
          height: '1',
          depth: '1',
          color: '#4CC3D9'
        }
      }),
      h('a-cylinder', {
        attrs: {
          position: '1 0.75 1',
          radius: '0.5',
          height: '1.5',
          color: '#FFC65D'
        }
      }),
      h('a-plane', {
        attrs: {
          rotation: '-90 0 0',
          width: '4',
          height: '4',
          color: '#7BC800'
        }
      }),
      h('a-sky', { attrs: {color: '#ECECEC'} })
    ])
  );

  return {
    DOM: vdom$
  };
}

Cycle.run(main, {
  DOM: makeDOMDriver('#app')
});