import xs, { Stream } from 'xstream';
import {h, div, span, button, DOMSource, VNode} from '@cycle/dom';
import isolate from '../ext/re-isolate';
import { Reducer, StateSource } from 'cycle-onionify';

type ButtonSources = {
  DOM: DOMSource,
  props$: Stream<{
    text: string
  }>
};
type ButtonSinks = {
  DOM: Stream<VNode>,
  click$: Stream<any>
};

function Button(sources: ButtonSources): ButtonSinks {
  let props$ = sources.props$;
	const click$ = sources.DOM.select('.button').events('click');
	const vdom$ = props$.map(props => button('.button', [props.text]));

	return {
		DOM: vdom$,
		click$
	};
}

type IncDecState = number;
type IncDecSources = {
  DOM: DOMSource,
  onion: StateSource<IncDecState>,
  props$: Stream<{
    min: number,
    text: string,
    increment?: number
  }>
};
type IncDecSinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<IncDecState>>
};

function IncDecButtons(sources: IncDecSources): IncDecSinks {
	const IncrementButton = isolate(Button);
	const DecrementButton = isolate(Button);

  const incrementButtonProps$ = xs.of({text: 'Increment'}).remember();
	const incrementButton = IncrementButton({DOM: sources.DOM, props$: incrementButtonProps$});
	const decrementButtonProps$ = xs.of({text: 'Decrement'}).remember();
  const decrementButton = DecrementButton({DOM: sources.DOM, props$: decrementButtonProps$});
  
  const props$ = sources.props$;
  const delta$: Stream<number> = props$
    .map(({increment}) => {
      const value = increment || 1;
      return xs.merge(
        incrementButton.click$.mapTo(value),
        decrementButton.click$.mapTo(-value));
    })
    .flatten();

  let state$ = sources.onion.state$;
  const reducer$ = xs.combine(delta$, props$)
    .map(([value, {min}]) => (prev: number) => Math.max((min || 0), value + prev));
  const vdom$ = xs.combine(state$, props$, incrementButton.DOM, decrementButton.DOM)
    .map(([state, props, incrementVTree, decrementVTree]) =>  div([
      span(props.text || "+/-"),
      span(`: ${state}`),
      incrementVTree,
      decrementVTree
    ]));

	return {
    DOM: vdom$,
    onion: reducer$
	};
};

export {
  Button,
  IncDecButtons
}
