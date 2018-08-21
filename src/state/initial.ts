import xs, {Stream} from 'xstream';

import {Tab} from '../components/tab';
import {CodecPayload, Mode as CodecMode} from '../components/codec';
import {Player as PlayerType, createPlayer, PlayerId} from '../components/players';

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
  mode: CodecMode,
  showHelp: boolean,
  viewer: 'listing' | 'player',
  tacticIdx: number,
  // Tactics
  tactics: Tactic[],
  display: TacticDisplay[]
};

const DEFAULT_DISPLAY: TacticDisplay = {
  tab: Tab.FIELD,
  editDescription: false
};

function getInitialV1State(state): State {
  const {tactics} = state.content as CodecPayload;
  const display = tactics.map(_ => DEFAULT_DISPLAY);
  return {
    mode: null,
    showHelp: false,
    viewer: 'player',
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#ffd400',
      '#17becf'
    ],
    tacticIdx: 0,
    tactics,
    display
  };
}

function getInitialDevState(): State {
  return {
    mode: null,
    showHelp: false,
    viewer: 'player',
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
        description: 'tactic description here',
        points: [
          createPlayer({id: 1, x: 0, y: -450}),
          createPlayer({id: 2, x: 0, y: -400})
        ],
        height: 2
      },
      {
        description: 'Second tactics',
        points: [
          createPlayer({id: 1, x: 0, y: -450}),
          createPlayer({id: 2, x: 0, y: -400}),
          createPlayer({id: 3, x: 0, y: -350})
        ],
        height: 3.5
      }
    ],
    display: [
      DEFAULT_DISPLAY,
      DEFAULT_DISPLAY
    ]
  };
}

function getDefaultInitialState(): State {
  return {
    mode: null,
    showHelp: false,
    viewer: 'player',
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#ffd400',
      '#17becf'
    ],
    tacticIdx: 0,
    tactics: [
      {
        description: '',
        points: [
          createPlayer({id: 1, x: 0, y: 0})
        ],
        height: 2
      }
    ],
    display: [
      DEFAULT_DISPLAY
    ]
  };
}

const getInitialState: () => State = () => {
  const stored = window.localStorage.getItem('story');
  window.localStorage.removeItem('story');
  if (stored) {
    try {
      const state = JSON.parse(stored);
      switch (state.version) {
        case 1: return getInitialV1State(state);
        default: console.error('Unknown version to load', state);
      }
    } catch (e) {
      console.error('Cannot load initial state', stored);
    }
  }

  // No initial state, load default
  return window.location.search === '?dev'
    ? getInitialDevState()
    : getDefaultInitialState();
};

export {
  Tactic,
  TacticDisplay,
  State,
  DEFAULT_DISPLAY,
  getInitialState
};
