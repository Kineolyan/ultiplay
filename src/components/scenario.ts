import xs, {Stream} from 'xstream';
import {div, DOMSource, VNode} from '@cycle/dom';
import { StateSource, Reducer } from 'cycle-onionify';

import {Tab} from './tab';
import {IncDecButtons, IncDecState} from './buttons';
import {Scene} from './3d-vision';
import {Field, State as FieldState, Sources as FieldSources, Sinks as FieldSinks} from './field';
import {Player, PlayerId} from './players';
import Description from './description';
import isolate from '../ext/re-isolate';
import { FieldType } from '../state/initial';
import { CanvasDescription } from '../driver/canvas';

type State = {
  colors: string[],
  tab: Tab,
  editDescription: boolean,
  selected?: PlayerId,
  description: string,
  height: number,
  points: Player[],
  fieldType: FieldType
};

type Sources = {
  onion: StateSource<State>,
  DOM: DOMSource
};
type Sinks = {
  DOM: Stream<VNode>,
  onion: Stream<Reducer<State>>,
  canvas: Stream<CanvasDescription>
};

function Scenario(sources: Sources): Sinks {
  const heightProps$ = xs.of({
      text: 'Height',
      increment: 0.25,
      format: n => n.toFixed(2)
    }).remember();
  const heightLens = {
    get({height}: State): IncDecState {
      return height;
    },
    set(state: State, height: IncDecState): State {
      return {...state, height};
    }
  };
  const heightInc = isolate(IncDecButtons, heightLens)({
   ...sources,
   props$: heightProps$
  }) as Sinks;

  const fieldLens = {
    get({points, colors, selected, fieldType}: State): FieldState {
      return {
        points,
        colors,
        selected,
        fieldType
      };
    },
    set(state: State, {points, selected, fieldType}: FieldState): State {
      return {
        ...state,
        points,
        selected,
        fieldType
      };
    }
  };
  const field = isolate<
    FieldSources<FieldState>, 
    FieldSinks<FieldState>, 
    FieldState,
    State,
    FieldSources<State>,
    FieldSinks<State>>(Field, fieldLens)(sources);

  const sceneLens = {
    get({height, points, colors}) {
      return {height, players: points, colors}
    },
    set: (state) => state
  };
  const scene = isolate(Scene, sceneLens)(sources);

  const descriptionLens = {
    get: ({description: value, editDescription: edit}) => ({value, edit}),
    set: (state, {value: description, edit: editDescription}) => ({...state, description, editDescription})
  };
  const description = isolate(Description, descriptionLens)(sources);

  const reducer$ = xs.merge(
    heightInc.onion,
    field.onion,
    description.onion);

  const canvas$ = field.canvas;

  const state$ = sources.onion.state$;
  const vdom$ = xs.combine(
      state$,
      scene.DOM,
      heightInc.DOM,
      field.DOM,
      description.DOM)
    .map(([{tab}, scene, heightInc, field, description]) => {
      const sceneGroup = div('.scene-group', [heightInc, scene]);
      const tabElements = [];
      let scenarioClass;
      switch (tab) {
        case Tab.FIELD:
          tabElements.push(field);
          scenarioClass = 'field-scenario';
          break;
        case Tab.VISION:
          tabElements.push(sceneGroup);
          scenarioClass = 'td-scenario';
          break;
        case Tab.COMBO:
          tabElements.push(field, sceneGroup);
          scenarioClass = 'combo-scenario';
          break;
        default:
          tabElements.push(div(`Unknown tab ${tab}`));
      }

      return div([
        description,
        div(`.scenario.${scenarioClass}`, tabElements)
      ]);
    })
    .replaceError(() => xs.of(div('Internal error in scenario')));

  return {
    DOM: vdom$,
    onion: reducer$,
    canvas: canvas$
  };
};

export default Scenario;
export {
  State
};
