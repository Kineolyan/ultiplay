import xs, {Stream} from 'xstream';
import {h, div, span, button, DOMSource, VNode} from '@cycle/dom';
import { makeCollection, Reducer, StateSource } from 'cycle-onionify';

import {Tab, getTabName} from './tab';
import Scenario, {State as ScenarioState} from './scenario';
import * as pag from './pagination';
import {Tactic, TacticDisplay} from '../state/initial';
import isolate from '../ext/re-isolate';
import { errorView } from '../operators/errors';

type State = {
  // Constants
  colors: string[],
  // Tactics
  tactics: Tactic[],
  display: TacticDisplay[]
};

type Sources<S> = {
  DOM: DOMSource,
  onion: StateSource<S>
};
type Sinks<S> = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<S>>,
  moveItem: Stream<pag.MoveRequest>,
  copyItem: Stream<pag.CopyRequest>,
  deleteItem: Stream<number>
};

type ItemState = {
  // Constants
  colors: string[],
  // Tactics
  current: number,
  pages: number,
  tactic: Tactic,
  display: TacticDisplay
};

function Item(sources: Sources<ItemState>): Sinks<ItemState> {
  const {DOM: dom$, onion: {state$}} = sources;

  const clicks$ = (selector: string) => dom$.select(selector).events('click');
  const movePrev$ = clicks$('.move-prev');
  const moveNext$ = clicks$('.move-next');
  const delete$ = clicks$('.delete');
  const copyAfter$ = clicks$('.copy-after');

  const tabClick$ = clicks$('.tab')
    .map(e => parseInt(e.target.dataset['id']) as Tab);
  const tabReducer$ = tabClick$.map(tab => (state: ItemState) => {
    const display = {...state.display, tab};
    return {
      ...state,
      display
    };
  });

  const movePrevOrder$ = state$
    .filter(({current}) => current > 1)
    .map(({current}) => movePrev$.map(() => ({from: current, to: current - 1})))
    .flatten();
  const moveNextOrder$ = state$
    .filter(({current, pages}) => current < pages)
    .map(({current}) => moveNext$.map(() => ({from: current, to: current + 1})))
    .flatten();
  const moveOrder$ = xs.merge(movePrevOrder$, moveNextOrder$);

  const deleteOrder$ = state$
    .filter(({pages}) => pages > 1)
    .map(({current}) => delete$.map(() => current))
    .flatten();

  const copyAfterOrder$ = state$
    .filter(({pages}) => pages > 0)
    .map(({current}) => copyAfter$.map(() => ({item: current, to: current + 1})))
    .flatten();

  const scenarioLens = {
    get(state: ItemState): ScenarioState {
      const {
        colors,
        tactic: {points, height, description},
        display: {tab, editDescription, selected, fieldType}
      } = state;
      return {colors, tab, selected, editDescription, points, height, description, fieldType};
    },
    set(state: ItemState, childState: ScenarioState): ItemState {
      const {points, height, description, editDescription, selected} = childState;
      const tactic = {points, height, description};
      const display = {...state.display, editDescription, selected};
      return {
        ...state,
        tactic,
        display
      };
    }
  };
  const scenario = isolate(Scenario, scenarioLens)(sources);

  const reducer$ = xs.merge(
    tabReducer$,
    scenario.onion);

  const vdom$ = xs.combine(
      state$,
      scenario.DOM)
    .map(([state, scenario]) => {
      const {display: {tab}, current, pages} = state;

      const tabs = [
        Tab.FIELD,
        Tab.VISION,
        Tab.COMBO
      ].map(t => {
        const attrs = {
          'data-id': t,
          class: 'tab',
          style: tab === t ? 'font-weight: bold' : ''
        };
        const name = getTabName(t);
        return h('li', {attrs}, name);
      });

      const deletAattrs = pages === 1
        ? {attrs: {disabled: ''}}
        : {};

      return div([
        h('ul', tabs),
        current > 1
          ? div([
              button('.move-prev', 'Move Previous')
            ])
          : null,
        scenario,
        div([
          span('Item operations: '),
          button('.copy-after', 'Duplicate'),
          button('.delete', deletAattrs, 'Delete')
        ]),
        current < pages
          ? div([
              button('.move-next', 'Move Next')
            ])
          : null
      ]);
    })
    .replaceError(errorView('tactic-player'));

  return {
    DOM: vdom$,
    onion: reducer$,
    moveItem: moveOrder$,
    copyItem: copyAfterOrder$,
    deleteItem: deleteOrder$
  };
}

function List(sources: Sources<ItemState[]>): Sinks<ItemState> {
	const L = makeCollection({
		item: Item,
		itemKey: (tactic: ItemState, index) => `${index}`,
		itemScope: key => key,
		collectSinks: instances => ({
      DOM: instances.pickCombine('DOM'),
      onion: instances.pickMerge('onion'),
      moveItem: instances.pickMerge('moveItem'),
      copyItem: instances.pickMerge('copyItem'),
      deleteItem: instances.pickMerge('deleteItem')
		})
	});
	return L(sources);
};

function Listing(sources: Sources<State>): Sinks<State> {
  const listLens = {
    get({colors, tactics, display}: State): ItemState[] {
      // A bit ugly without zip
      return tactics.map((tactic, idx) => ({
        colors,
        tactic,
        display: display[idx],
        current: idx + 1,
        pages: tactics.length
      }));
    },
    set(state: State, childStates: ItemState[]): State {
      return {
        ...state,
        tactics: childStates.map(s => s.tactic),
        display: childStates.map(s => s.display)
      };
    }
  };
  const list = isolate(List, listLens)(sources) as Sinks<State>;

  const reducer$ = xs.merge(
    list.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      list.DOM)
    .map(([state, list]) => {
      return div(list);
    })
    .replaceError(errorView('player-list'));

  return {
    DOM: vdom$,
    onion: reducer$,
    moveItem: list.moveItem,
    copyItem: list.copyItem,
    deleteItem: list.deleteItem
  };
};

export default Listing;
export {
  State,
  Sources,
  Sinks
};
