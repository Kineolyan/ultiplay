import { DOMSource, VNode, div, h, button, span } from "@cycle/dom";
import { Stream } from "xstream";
import { Reducer } from "cycle-onionify";

type State = boolean;

type Sources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State>
  }
};

type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>
};

function Help({DOM: dom$, onion: {state$}}: Sources): Sinks {
  const click$ = dom$.select('.toggle').events('click');
  const toggleReducer$ = click$.map(() => show => !show);

  const vdom$ = state$.map(show => {
    const toggle = button('.toggle', show ? 'Hide' : 'Show');
    if (show) {
      const message = div(
        h('p', 
          h('i', 
            'Double Click on the description to edit it')));
      return div([
        span('Help: '),
        toggle,
        message
      ]);
    } else {
      return div([
        span('Help: '),
        toggle
      ]);
    }
  });
  
  return {
    DOM: vdom$,
    onion: toggleReducer$
  };
}

export default Help;