import xs, { Stream } from 'xstream';
import debounce from 'xstream/extra/debounce';
import {h, div, button, textarea, sub, DOMSource, VNode} from '@cycle/dom';
import { StateSource, Reducer } from 'cycle-onionify';
import isolate from '@cycle/isolate';

import {trigger} from '../operators/trigger';
import Editor from '../elements/editor';
import {Player as PlayerType} from './players';

type Mode = null | 'import' | 'export';
type Tactic = {
  description: string,
  height: number,
  points: PlayerType[]
};
type CodecPayload = {
  tactics: Tactic[]
};
type State = {
  mode: Mode,
  payload: CodecPayload
};
type Sources = {
  DOM: DOMSource,
  onion: StateSource<State>
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>
};

const renderMode = (state, editor) => {
  switch (state.mode) {
    case 'export': return div([
      h(
        'pre',
        JSON.stringify(state.payload, null, 2)),
      button('.close', 'Close')
    ]);
    case 'import': return editor;
    case null: return undefined;
    default: return div(`Unknown mode ${state.mode}`);
  }
};

function CoDec(sources: Sources): Sinks {
  const export$ = sources.DOM.select('.export')
    .events('click')
    .mapTo('export');
  const import$ = sources.DOM.select('.import')
    .events('click')
    .mapTo('import');
  const close$ = sources.DOM.select('.close').events('click');

  const editor = isolate(Editor)({
    DOM: sources.DOM,
    props$: xs.of({value: ''})
  });
  const mode$ = xs.merge(
    export$,
    import$,
    xs.merge(editor.value$, close$).mapTo(null));

  const modeProducer$ = mode$.map(mode => ({mode}));
  const valueProducer$ = editor.value$
    .map(value => {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    })
    .map(payload => ({payload}));
  const reducer$ = xs.merge(modeProducer$, valueProducer$)
    .map(value => state => Object.assign({}, state, value));

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(state$, editor.DOM)
    .map(([state, editor]) =>
      div(
        '#codec',
        [
          div([
            button('.import', 'Import'),
            button('.export', 'Export')
          ]),
          renderMode(state, editor)
        ]
      ));

	return {
    DOM: vdom$,
    onion: reducer$
	};
}

export default CoDec;
export {
  Mode,
  CodecPayload,
  State
};
