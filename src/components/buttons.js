import xs from 'xstream';
import {h, div, span, button} from '@cycle/dom';
import isolate from '@cycle/isolate';

const Button = (sources) => {
  let props$ = sources.props$;
	const click$ = sources.DOM.select('.button').events('click');
  const delta$ = props$
    .map((props) => click$.map(() => props.amount))
    .flatten();
	const vdom$ = props$.map(props => button('.button', [props.text]));

	return {
		DOM: vdom$,
		delta$: delta$
	};
}

const IncDecButtons = (sources) => {
	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

  const props$ = sources.props$;
  const incrementButtonProps$ = props$
    .map(({increment}) => ({text: 'Increment', amount: increment || 1}))
    .remember();
	const decrementButtonProps$ = props$
    .map(({increment}) => ({text: 'Decrement', amount: -(increment || 1)}))
    .remember();

	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});

  let state$ = sources.onion.state$;
  const picks$ = xs.merge(incrementButton.delta$, decrementButton.delta$);
  const reducer$ = xs.combine(picks$, props$)
    .map(([value, {min}]) => prev => Math.max((min || 0), value + prev));
  const vdom$ = xs.combine(state$, props$, incrementButton.DOM, decrementButton.DOM)
    .map(([state, props, incrementVTree, decrementVTree]) =>  div([
      span(props.text || "+/-"),
      span(`: ${state}`),
      incrementVTree,
      decrementVTree
    ]));
	return {
    DOM: vdom$,
    onion: reducer$,
    increment: picks$
	};
};

export {
  Button,
  IncDecButtons
}
