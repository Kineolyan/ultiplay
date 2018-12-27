import xs, {Stream} from 'xstream';
import run from '@cycle/run';
import {h, div, button, makeDOMDriver, DOMSource, VNode} from '@cycle/dom';
import onionify, { Reducer, StateSource } from 'cycle-onionify';
import 'aframe';
import 'aframe-environment-component';

import isolate from './ext/re-isolate';
import {State, getInitialState, TacticDisplay, Tactic, View} from './state/initial';
import Codec, {State as CodecState} from './components/codec';
import Player, {State as PlayerState, Sinks as PlayerSinks} from './components/tactic-player';
import Listing, {State as ListingState, Sinks as ListingSinks} from './components/tactic-list';
import {copyItem, moveItem, deleteItem} from './state/operators';
import Help, {Sources as HelpSources, Sinks as HelpSinks} from './components/help';
import { errorView } from './operators/errors';
import { composablePrint } from './operators/out';

type Sources = {
  DOM: DOMSource,
  onion: StateSource<State>
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>
};

const cloneTactic: (Tactic) => Tactic = ({height, description, points}) => ({
  height,
  description,
  points: points.map(p => ({...p}))
});
const cloneDisplay: (TacticDisplay) => TacticDisplay = (display) => ({
  ...display
});

function main(sources: Sources): Sinks {
  const initialReducer$: Stream<Reducer<State>> = xs.of(() => getInitialState());

  const codecLens = {
    get({tactics, mode}: State): CodecState {
      return {
        payload: {tactics},
        mode
      };
    },
    set(state: State, {mode, payload}: CodecState): State {
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
  const codec = isolate(Codec, codecLens)(sources);

  const playerLens = {
    get(state: State): PlayerState {
      return state;
    },
    set(state: State, childState: PlayerState): State {
      return {...state, ...childState};
    }
  };
  const player = isolate(Player, playerLens)(sources) as PlayerSinks<State>;

  const listingLens = {
    get(state: State): ListingState {
      return state;
    },
    set(state: State, childState: ListingState): State {
      return {...state, ...childState};
    }
  };
  const listing = isolate(Listing, listingLens)(sources) as ListingSinks<State>;

  const moveReducer$ = xs.merge(
      player.moveItem,
      listing.moveItem)
    .map(({from, to}) => state => {
      const tactics = moveItem(state.tactics, from, to);
      const display = moveItem(state.display, from, to);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const copyReducer$ = xs.merge(
      player.copyItem,
      listing.copyItem)
    .map(({item, to}) => state => {
      const tactics = copyItem(state.tactics, item, to, cloneTactic);
      const display = copyItem(state.display, item, to, cloneDisplay);
      return {
        ...state,
        tacticIdx: to - 1,
        tactics,
        display
      };
    });
  const deleteReducer$ = xs.merge(
      player.deleteItem,
      listing.deleteItem)
    .map((idx) => state => {
      const tactics = deleteItem(state.tactics, idx);
      const display = deleteItem(state.display, idx);
      return {
        ...state,
        tacticIdx: Math.min(idx, tactics.length) - 1,
        tactics,
        display
      };
    });

  const help = isolate<HelpSources, HelpSinks>(Help)(sources);

  const viewReducer$ = sources.DOM.select('.target-link').events('click')
    .map(e => {
      e.preventDefault();
      e.stopPropagation();
      return (e.currentTarget.dataset.target as string);
    })
    .map(view => state => ({...state, view}));

  const viewerReducer$ = xs.merge(
    sources.DOM.select('.player-view').events('click').mapTo('player'),
    sources.DOM.select('.listing-view').events('click').mapTo('listing'))
    .map(viewer => state => ({...state, viewer}));

  const reducer$ = xs.merge(
    initialReducer$,
    viewReducer$,
    codec.onion,
    xs.merge(
      player.onion,
      moveReducer$,
      copyReducer$,
      deleteReducer$),
    listing.onion,
    viewerReducer$);

  const state$ = sources.onion.state$
    .compose(composablePrint('full-state'));
  const vdom$ = xs.combine(
      state$,
      codec.DOM,
      player.DOM,
      listing.DOM,
      help.DOM)
    .map(([state, codec, player, listing, help]) => {
      const {viewer, view} = state;
      const viewerToggle = div(
        '.ui.buttons',
        [
          div([
            button('.player-view.ui.button', 'Player'),
            button('.listing-view.ui.button', 'Listing')])
        ]);
      const viewerDOM = [
        viewerToggle, 
        (viewer === 'listing' ? listing : player)
      ];

      const visibilityClass = '.uncover.visible';
      const viewLinks: {target: View, label: string, icon: string}[] = [
        {target: 'tactics', label: 'Tactics', icon: 'book'},
        {target: 'codec', label: 'Import/Export', icon: 'download'},
        {target: 'help', label: 'Help', icon: 'question circle'}
      ];
      const views = {
        tactics: div(viewerDOM),
        codec,
        help
      };

      return div([
        div(
          `.ui.sidebar.inverted.vertical.labeled.icon.menu.left${visibilityClass}`,
          viewLinks.map(v => h(
            'a',
            {attrs: {
              class: `item target-link ${v.target === view ? 'active' : ''}`,
              'data-target': v.target
            }},
            [
              h('i', {attrs: {class: `icon ${v.icon}`}}),
              h('span', v.label)
            ]))),
        div('.pusher', [
          div('Small browser application to display Ultimate tactics in 3D'),
          views[view]
        ])
      ]);
    })
    .replaceError(errorView('main'));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
};

run(
  onionify(main),
  {DOM: makeDOMDriver('#app')});
