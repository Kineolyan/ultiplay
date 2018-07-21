import xs from 'xstream';
import debounce from 'xstream/extra/debounce';
import {h, div, button, textarea, sub} from '@cycle/dom';

import {composableTrigger as trigger} from '../operators/trigger.js';

const renderMode = (state) => {
  switch (state.mode) {
    case 'export': return div([
      h(
        'pre',
        JSON.stringify(state.payload, null, 2)),
      button('.close', 'Close')
    ]);
    case 'import': return div([
      textarea(''),
      button('.submit', 'Submit')
    ]);
    default: return undefined;
  }
};

const CoDec = (sources) => {
  const export$ = sources.DOM.select('.export')
    .events('click')
    .mapTo('export');
  const import$ = sources.DOM.select('.import')
    .events('click')
    .mapTo('import');
  const submit$ = sources.DOM.select('.submit').events('click');
  const close$ = sources.DOM.select('.close').events('click');
  const value$ = sources.DOM.select('#codec').events('input')
    .filter(e => e.srcElement.type === 'textarea')
    .compose(debounce(250))
    .map(e => e.srcElement.value)
    .map(value => {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    })
    .startWith(undefined)
    .compose(trigger(submit$));
  const mode$ = xs.merge(
    export$,
    import$,
    xs.merge(submit$, close$).mapTo(null));

  const reducer$ = xs.merge(
      mode$.map(mode => ({mode})),
      value$.map(value => ({payload: value})))
    .map(state => prev => state);

  const state$ = sources.onion.state$;
  const vdom$ = state$.map(state =>
    div(
      '#codec',
      [
        div([
          button('.import', 'Import'),
          button('.export', 'Export')
        ]),
        renderMode(state)
      ]
    ));

	return {
    DOM: vdom$,
    onion: reducer$
	};
}

export default CoDec;
