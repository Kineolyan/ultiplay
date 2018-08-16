import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify, { makeCollection, Reducer } from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab, getTabName} from './tab';
import {Player as PlayerType, createPlayer, PlayerId} from './players';
import Scenario, {State as ScenarioState} from './scenario';
import Pagination, * as pag from './pagination';
import {updateItem, copyItem, moveItem, deleteItem} from '../state/operators';
import {Tactic, TacticDisplay, DEFAULT_DISPLAY} from '../state/initial';

type State = {
  // Constants
  colors: string[],
  // Tactics
  tactics: Tactic[],
  display: TacticDisplay[]
};

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

type ItemState = {
  // Constants
  colors: string[],
  // Tactics
  tactic: Tactic,
  display: TacticDisplay
};
type ItemSources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<ItemState>
  }
};
type ItemSinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<ItemState>>
};

const cloneTactic = ({height, description, points}) => ({
  height,
  description,
  points: points.map(p => ({...p}))
});

function Item(sources: ItemSources): ItemSinks {
  const {DOM: dom$, onion: {state$}} = sources;

  const tabClick$ = dom$.select('.tab').events('click')
    .map(e => parseInt(e.srcElement.dataset['id']) as Tab);
  const tabReducer$: Stream<Reducer<State>> = tabClick$.map(tab => state => {
    const display = {...state.display, tab};
    return {
      ...state,
      display
    };
  });

  const scenarioLens = {
    get(state: ItemState): ScenarioState {
      const {
        colors,
        tactic: {points, height, description},
        display: {tab, editDescription, selected}
      } = state;
      return {colors, tab, selected, editDescription, points, height, description};
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
  const scenario = isolate(Scenario, {onion: scenarioLens})(sources);

  const reducer$ = xs.merge(
    tabReducer$,
    scenario.onion);

  const vdom$ = xs.combine(
      state$,
      scenario.DOM)
    .map(([state, scenario]) => {
      const {display: {tab}} = state;

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

      return div([
        h('ul', tabs),
        scenario
      ]);
    })
    .replaceError(() => xs.of(div(`Internal error in tactic player`)));

  return {
    DOM: vdom$,
    onion: reducer$
  };
}

const List = (sources) => {
	const L = makeCollection({
		item: Item,
		itemKey: (tactic: ItemState, index) => `${index}`,
		itemScope: key => key,
		collectSinks: instances => ({
      DOM: instances.pickCombine('DOM'),
      onion: instances.pickMerge('onion')
		})
	});
	return L(sources);
};

function Listing(sources: Sources): Sinks {
  // const moveReducer$ = pagination.moveItem.map(
  //   ({from, to}) => state => {
  //     const tactics = moveItem(state.tactics, from, to);
  //     const display = moveItem(state.display, from, to);
  //     return {
  //       ...state,
  //       tacticIdx: to - 1,
  //       tactics,
  //       display
  //     };
  //   });
  // const copyReducer$ = pagination.copyItem.map(
  //   ({item, to}) => state => {
  //     const tactics = copyItem(state.tactics, item, to, cloneTactic);
  //     const display = copyItem(state.display, item, to, () => DEFAULT_DISPLAY);
  //     return {
  //       ...state,
  //       tacticIdx: to - 1,
  //       tactics,
  //       display
  //     };
  //   });
  // const deleteReducer$ = pagination.deleteItem.map(
  //   (idx) => state => {
  //     const tactics = deleteItem(state.tactics, idx);
  //     const display = deleteItem(state.display, idx);
  //     return {
  //       ...state,
  //       tacticIdx: Math.min(idx, tactics.length) - 1,
  //       tactics,
  //       display
  //     };
  //   });

  const listLens = {
    get({colors, tactics, display}: State): ItemState[] {
      // A bit ugly without zip
      return tactics.map((tactic, idx) => ({
        colors,
        tactic,
        display: display[idx]
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
  const list = isolate(List, {onion: listLens})(sources);
  
  const reducer$ = xs.merge(
    list.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      list.DOM)
    .map(([state, list]) => {
      return div(list);
    })
    .replaceError(() => xs.of(div(`Internal error in tactic list`)));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

export default Listing;
export {
  State
};
