import xs from 'xstream';
import {h, div, button, textarea} from '@cycle/dom';

const CoDec = (sources) => {
	const click$ = sources.DOM.select('.button').events('click');
  const state$ = sources.onion.state$;
  const vdom$ = state$.debug('inner').map(state =>
    div(
      '#codec',
      [
        h(
          'pre',
          JSON.stringify(state, null, 2)),
        div([
          button('Import'),
          button('Export')
        ])
      ]
    ))
    .debug('cdc');

	return {
		DOM: vdom$
	};
}

export default CoDec;
