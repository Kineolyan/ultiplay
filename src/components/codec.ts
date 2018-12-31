import xs, { Stream } from 'xstream';
import {h, div, button, i, DOMSource, VNode} from '@cycle/dom';
import { StateSource, Reducer } from 'cycle-onionify';

import {trigger} from '../operators/trigger';
import Editor from '../elements/editor';
import {Player as PlayerType} from './players';
import isolate from '../ext/re-isolate';
import { IOAction, Operation as IOOperation } from '../driver/io';

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
  onion: Stream<Reducer<State>>,
  io: Stream<IOAction>
};

const renderMode = (state: State, editor: VNode) => {
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

const createNotebookContent = ({payload}: State) => `
var content = ${JSON.stringify(payload, null, 2)};

window.localStorage.setItem(
  'story',
  JSON.stringify({version: 1, content: content}));
`;

function CoDec(sources: Sources): Sinks {
  const export$ = sources.DOM.select('.export')
    .events('click')
    .mapTo('export');
  const import$ = sources.DOM.select('.import')
    .events('click')
    .mapTo('import');
  const download$ = sources.DOM.select('.download')
    .events('click');
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
  const io$ = state$.compose(trigger(download$))
    .map(state => ({
      operation: 'export' as IOOperation,
      content: createNotebookContent(state)
    }));

  const vdom$ = xs.combine(state$, editor.DOM)
    .map(([state, editor]) =>
      div(
        '#codec',
        [
          div([
            button('.ui.primary.button.download', [
              i('.download.icon'),
              'Download']),
            button('.ui.button.import', [
              i('.play.circle.icon'),
              'Import']),
            button('.ui.button.export', [
              i('.save.icon'),
              'Export'])
          ]),
          renderMode(state, editor)
        ]
      ));

	return {
    DOM: vdom$,
    onion: reducer$,
    io: io$
	};
}

export default CoDec;
export {
  Mode,
  CodecPayload,
  State,
  Sources,
  Sinks
};
