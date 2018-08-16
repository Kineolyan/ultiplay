import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify, { Reducer } from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab, getTabName} from './tab';
import {Player as PlayerType, createPlayer, PlayerId} from './players';
import Scenario, {State as ScenarioState} from './scenario';
import Pagination, * as pag from './pagination';
import {updateItem, copyItem, moveItem, deleteItem} from '../state/operators';

type Tactic = {
  description: string,
  height: number,
  points: PlayerType[]
};
type TacticDisplay = {
  tab: Tab,
  editDescription: boolean,
  selected?: PlayerId,
};
type State = {
  // Constants
  colors: string[],
  mode: string | null,
  tacticIdx: number,
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

const DEFAULT_DISPLAY: TacticDisplay = {
  tab: Tab.FIELD,
  editDescription: false
};

const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];
const getDisplay: (s: State) => TacticDisplay = (state) => state.display[state.tacticIdx];
const cloneTactic = ({height, description, points}) => ({
  height,
  description,
  points: points.map(p => ({...p}))
});

function Player(sources: Sources): Sinks {
  const tabClick$ = sources.DOM.select('.tab').events('click')
    .map(e => parseInt(e.srcElement.dataset['id']) as Tab);
  const tabReducer$: Stream<Reducer<State>> = tabClick$.map(tab => state => {
    const display  = updateItem(
      state.display,
      state.tacticIdx,
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
      const {tab, editDescription, selected} = getDisplay(state);
      return {colors, tab, selected, editDescription, points, height, description};
    },
    set(state: State, childState: ScenarioState): State {
      const {points, height, description, editDescription, selected} = childState;
      const tactics = updateItem(
        state.tactics,
        state.tacticIdx,
        _ => ({points, height, description}));
      const display = updateItem(
        state.display,
        state.tacticIdx,
        d => ({...d, editDescription, selected}));
      return {
        ...state,
        tactics,
        display
      };
    }
  };
  const scenario = isolate(Scenario, {onion: scenarioLens})(sources);

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
  const pagination = isolate(Pagination, {onion: paginationLens})(sources);
  const moveReducer$ = pagination.moveItem.map(
    ({from, to}) => state => {
      const tactics = moveItem(state.tactics, from, to);
      const display = moveItem(state.display, from, to);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const copyReducer$ = pagination.copyItem.map(
    ({item, to}) => state => {
      const tactics = copyItem(state.tactics, item, to, cloneTactic);
      const display = copyItem(state.display, item, to, () => DEFAULT_DISPLAY);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const deleteReducer$ = pagination.deleteItem.map(
    (idx) => state => {
      const tactics = deleteItem(state.tactics, idx);
      const display = deleteItem(state.display, idx);
      return {
        ...state,
        tacticIdx: Math.min(idx, tactics.length) - 1,
        tactics,
        display
      };
    });
  
  const reducer$ = xs.merge(
    tabReducer$,
    scenario.onion,
    xs.merge(
      pagination.onion,
      moveReducer$,
      copyReducer$,
      deleteReducer$));

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
        case Tab.CODEC:
          break; // Nothing to display
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

      const tabs = [
        Tab.FIELD,
        Tab.VISION,
        Tab.COMBO,
        Tab.CODEC
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
  };
};

export default Player;
export {
  State
};
