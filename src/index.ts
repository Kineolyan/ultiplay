import xs, {Stream} from 'xstream';
import Cycle from '@cycle/xstream-run';
import {h, div, span, button, makeDOMDriver, i, table, DOMSource, VNode} from '@cycle/dom';
import onionify from 'cycle-onionify';
import isolate from '@cycle/isolate';
import 'aframe';
import 'aframe-environment-component';

import {Tab, getTabName} from './components/tab';
import Codec from './components/codec';
import {Player, createPlayer, PlayerId} from './components/players';
import Scenario, {State as ScenarioState} from './components/scenario';
import Pagination, {State as PaginationState} from './components/pagination';

type Tactic = {
  description: string,
  height: number,
  points: Player[]
};
type State = {
  // Constants
  colors: string[],
  // Transient
  tab: Tab,
  mode: string | null,
  editDescription: boolean,
  selected?: PlayerId,
  tacticIdx: number,
  // Tactics
  tactics: Tactic[]
};

type Sources = {
  DOM: DOMSource,
  onion: {
    state$: Stream<State>
  }
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<(State) => State>
};

const getTactic: (s: State) => Tactic = (state) => state.tactics[state.tacticIdx];

const updateTactics: (s: State, t: Tactic) => State = (state, t) => {
  const tactics = state.tactics.slice();
  tactics[state.tacticIdx] = t;
  state.tactics = tactics;

  return state;
};

function main(sources: Sources): Sinks {
  const initialReducer$: Stream<(State) => State> = xs.of(() => ({
    tab: Tab.FIELD,
    mode: null,
    editDescription: false,
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#ffd400',
      '#17becf'
    ],
    tacticIdx: 1,
    tactics: [
      {
        description: '<tactic description here>',
        points: [
          createPlayer({id: 1, x: 0, y: 0}),
          createPlayer({id: 2, x: 0, y: 50})
        ],
        height: 2
      },
      {
        description: 'Second tactics',
        points: [
          createPlayer({id: 1, x: 0, y: 0}),
          createPlayer({id: 2, x: 0, y: 50}),
          createPlayer({id: 3, x: 0, y: -50})
        ],
        height: 3.5
      }
    ]
  }));

  const codecLens = {
    get: ({tactics, selected, mode}) => ({
      payload: {selected, tactics},
      mode
    }),
    set: (state, {mode, payload}) => {
      const newState = {...state};
      if (payload !== undefined) {
        Object.assign(newState, payload);
      }
      if (mode !== undefined) {
        newState.mode = mode;
      }
      return newState;
    }
  };
  const codec = isolate(Codec, {onion: codecLens})(sources);

  const tabClick$ = sources.DOM.select('.tab').events('click')
    .map(e => parseInt(e.srcElement.dataset['id']) as Tab);
  const tabReducer$ = tabClick$.map(tab => state => ({...state, tab}));

  const scenarioLens = {
    get(state: State): ScenarioState {
      const {colors, tab, editDescription, selected} = state;
      const {points, height, description} = getTactic(state);
      return {colors, tab, selected, editDescription, points, height, description};
    },
    set(state: State, childState: ScenarioState): State {
      const {points, height, description, editDescription, selected} = childState;
      const newState = {
        ...state,
        editDescription,
        selected
      };
      return updateTactics(newState, {points, height, description});
    }
  };
  const scenario = isolate(Scenario, {onion: scenarioLens})(sources);

  const paginationLens = {
    get({tacticIdx, tactics}: State): PaginationState {
      return {
        current: tacticIdx + 1, 
        pages: tactics.length
      };
    },
    set(state: State, {current}: PaginationState): State {
      return {...state, tacticIdx: current - 1};
    }
  };
  const pagination = isolate(Pagination, {onion: paginationLens})(sources);
  
  const reducer$ = xs.merge(
    initialReducer$,
    scenario.onion,
    codec.onion,
    pagination.onion,
    tabReducer$);

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      scenario.DOM,
      codec.DOM,
      pagination.DOM)
    .map(([{tab}, scenario, codec, pagination]) => {
      const tabElements = [];
      switch (tab) {
        case Tab.FIELD:
        case Tab.VISION:
        case Tab.COMBO:
          tabElements.push(scenario);
          break;
        case Tab.CODEC:
          tabElements.push(codec);
          break;
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
        div('Small browser application to display Ultimate tactics in 3D'),
        h('ul', tabs),
        pagination,
        ...tabElements
      ]);
    })
    .replaceError(() => xs.of(div('Internal error')));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

Cycle.run(
  onionify(main),
  {DOM: makeDOMDriver('#app')});
