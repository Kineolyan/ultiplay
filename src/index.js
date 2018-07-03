import xs from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, button, makeDOMDriver} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
require('aframe');
require("aframe-environment-component");

const Button = (sources) => {
	let props$ = sources.props$;
	const click$ = sources.DOM.select('.button').events('click');
  const delta$ = props$
    .map((props) => click$.map((ev) => props.amount))
    .flatten();
	const vdom$ = props$.map(props => button('.button', [props.text]));

	return {
		DOM: vdom$,
		delta$: delta$
	}
}


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

const renderScene = () => h(
  'a-scene', 
  {
    attrs: {
      environment: 'preset: forest',
      embedded: ''
    }
  }, 
  [
    ...cyclinders(3),
    h(
      'a-entity',
      {
        attrs: {
          position: '0 1 0',
          rotation: '-15 0 0'
        }
      },
      [
        h('a-camera', [
          h('a-cursor', {attrs: {color: '#FAFAFA'}})
        ])
      ])
  ]);

const main = (sources) => {
  const state$ = sources.onion.state$;

	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

	const incrementButtonProps$ = xs.of({text: 'Increment', amount: 1}).remember();
	const decrementButtonProps$ = xs.of({text: 'Decrement', amount: -1}).remember();

	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});

	const count$ = xs.merge(incrementButton.delta$, decrementButton.delta$)
    .fold((acc, x) => acc + x, 0)
    .mapTo(v => {
      console.log('value', v);
      return v;
    })
    .mapTo(value => ({value}));
  const initialReducer$ = xs.of(() => ({value: 0}));
  const addOneReducer$ = xs.periodic(1000)
    .mapTo((prev) => ({ value: prev.value + 1 }));
  const reducer$ = xs.merge(initialReducer$, addOneReducer$);

  const resultDom$ = state$.map(state => div(`Current count: ${state.value}`));
  const vdom$ = xs.combine(resultDom$, incrementButton.DOM, decrementButton.DOM)
    .map(([count, incrementVTree, decrementVTree]) => div(
      [
        div('Small browser application to display Ultimate tactics in 3D'),
        count,
        div([
          incrementVTree,
          decrementVTree
        ]),
        div(
          {attrs: {id: 'view-3d'}},
          [renderScene()])
      ]));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}

Cycle.run(
  onionify(main), 
  {DOM: makeDOMDriver('#app')});