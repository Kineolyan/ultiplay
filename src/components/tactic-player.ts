import xs, {Stream} from 'xstream';
import {h, div, DOMSource, VNode} from '@cycle/dom';
import { Reducer, StateSource } from 'cycle-onionify';

import {Tab, getTabName} from './tab';
import Scenario, {State as ScenarioState} from './scenario';
import Pagination, * as pag from './pagination';
import {updateItem, updateItems} from '../state/operators';
import {Tactic, TacticDisplay} from '../state/initial';
import isolate from '../ext/re-isolate';

type State = {
  // Constants
  colors: string[],
  tacticIdx: number,
  // Tactics
  tactics: Tactic[],
  display: TacticDisplay[]
};

type Sources = {
  DOM: DOMSource,
  onion: StateSource<State>
};
type Sinks<S> = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<S>>,
  moveItem: Stream<pag.MoveRequest>,
  copyItem: Stream<pag.CopyRequest>,
  deleteItem: Stream<number>
};

const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];
const getDisplay: (s: State) => TacticDisplay = (state) => state.display[state.tacticIdx];

function Player(sources: Sources): Sinks<State> {
  const tabClick$ = sources.DOM.select('.tab').events('click')
    .map(e => parseInt(e.target.dataset['id']) as Tab);
  const tabReducer$: Stream<Reducer<State>> = tabClick$.map(tab => state => {
    // Update all displays to the same view
    const display  = updateItems(
      state.display,
      () => true,
      display => ({...display, tab}));
    return {
      ...state,
      display
    };
  });

  const scenarioLens = {
    get(state: State): ScenarioState {
      const {colors} = state;
      const {points, height, description} = getTactic(state);
      const {tab, editDescription, selected, fieldType} = getDisplay(state);
      return {colors, tab, selected, editDescription, points, height, description, fieldType};
    },
    set(
        state: State,
        {points, height, description, editDescription, selected, fieldType}: ScenarioState): State {
      const tactics = updateItem(
        state.tactics,
        state.tacticIdx,
        _ => ({points, height, description}));
      const display = updateItem(
        state.display,
        state.tacticIdx,
        d => ({...d, editDescription, selected, fieldType}));
      return {
        ...state,
        tactics,
        display
      };
    }
  };
  const scenario = isolate(Scenario, scenarioLens)(sources);

  const paginationLens = {
    get({tacticIdx, tactics}: State): pag.State {
      return {
        current: tacticIdx + 1,
        pages: tactics.length
      };
    },
    set(state: State, {current, pages}: pag.State): State {
      return {...state, tacticIdx: current - 1};
    }
  };
  const pagination = isolate(Pagination, paginationLens)(sources) as pag.Sinks<State>;

  const reducer$ = xs.merge(
    tabReducer$,
    scenario.onion,
    pagination.onion);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      scenario.DOM,
      pagination.DOM)
    .map(([state, scenario, pagination]) => {
      const {tab} = getDisplay(state);
      const tabElements = [];
      switch (tab) {
        case Tab.FIELD:
        case Tab.VISION:
        case Tab.COMBO:
          tabElements.push(pagination, scenario);
          break;
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

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

      return div(
      [
        h('ul', tabs),
        ...tabElements
      ]);
    })
    .replaceError(() => xs.of(div(`Internal error in tactic player`)));

  return {
    DOM: vdom$,
    onion: reducer$,
    moveItem: pagination.moveItem,
    copyItem: pagination.copyItem,
    deleteItem: pagination.deleteItem
  };
};

export default Player;
export {
  State,
  Sources,
  Sinks
};
