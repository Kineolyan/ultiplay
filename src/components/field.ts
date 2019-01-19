import xs, {Stream} from 'xstream';
import {h, div, DOMSource, VNode} from '@cycle/dom';
import {makeCollection, StateSource, Reducer} from 'cycle-onionify';

import {createPlayer, generatePlayerId, PlayerId, Player} from './players';
import {Button, ModeButtons, ModeState, ModeSinks} from './buttons';
import {FieldType} from '../state/initial';
import isolate from '../ext/re-isolate';
import { errorView } from '../operators/errors';
import { CanvasDescription, Drawing, Circle, Rect } from '../driver/canvas';

// Dimension in decimeters
const FIELD_WIDTH: number = 380;
const FIELD_HEIGHT: number = 1000;
const ZONE_HEIGHT: number = 180;
const FIELD_SCALE: number = 1;

const makeField = (fieldType: FieldType): Rect[] => {
	const viewport = fieldViewPort(fieldType);
	const dims = fieldSize(fieldType);
	const {scale} = dims;

	return [
		{
			x: 1,
			y: 1,
			width: FIELD_WIDTH * FIELD_SCALE - 2,
			height: FIELD_HEIGHT * FIELD_SCALE - 2
		},
		{
			x: 1,
			y: ZONE_HEIGHT * FIELD_SCALE,
			width: FIELD_WIDTH * FIELD_SCALE - 1,
			height: (FIELD_HEIGHT - 2 * ZONE_HEIGHT) * FIELD_SCALE
		}
	]
		// Tranlate and scale to viewport
		.map(({x, y, width, height}) => ({
			x: (x - viewport.x) * scale,
			y: (y - viewport.y) * scale,
			width: width * scale,
			height: height * scale,
			strike: 2,
			color: 'black'
		}));
};

type ViewPort = {
	x: number, 
	y: number,
	height: number,
	width: number
};
type Position = {
	x: number,
	y: number
};
type PointState = {
	id: number | string,
	x: number,
	y: number,
	color: number
};
type PointItemState = {
	id: number | string,
	x: number,
	y: number,
	color: string,
	selected: boolean,
	fieldType: FieldType
};
type PointSources<S> = {
	DOM: DOMSource,
	onion: StateSource<S>
};
type PointSinks<E> = {
	point: Stream<E>
};

function updatePlayerState(state: State, value: PointState): State {
	const {points} = state;
	const idx = points.findIndex(v => v.id === value.id);
	const copy = [...points];
	copy[idx] = Object.assign(copy[idx], value);
	return {...state, points: copy};
}

const toViewPort = (viewport: ViewPort, point: PointItemState): PointItemState | null => {
	const {x, y} = toField({
		x: point.x - viewport.x,
		y: point.y - viewport.y
	});
	if (0 <= x && x <= viewport.width 
			&& 0 <= y && y <= viewport.height) {
		const {width, height} = fieldSize(point.fieldType);
		return {
			...point, 
			x: x * width / viewport.width, 
			y: y * height / viewport.height
		};
	} else {
		return null;
	}
}

const drawPoint = ({x, y, color, fieldType, selected}: PointItemState): Circle => {
	const {scale} = fieldSize(fieldType);
	return {
		x,
		y,
		radius: 17 * scale,
		color: color,
		strike: selected ? 3 : 1
	};
};

function Point(sources: PointSources<PointItemState>): PointSinks<Drawing | null> {
	const state$ = sources.onion.state$;
	const point$ = state$
		.map(p => {
			const ap = toViewPort(fieldViewPort(p.fieldType), p);
			return ap ? drawPoint(ap) : null;
		});
	return {
		point: point$
	};
};

function Points(sources: PointSources<PointItemState[]>): PointSinks<(Drawing | null)[]> {
	const PointCollection = makeCollection({
		item: Point,
		itemKey: (point: PointItemState, index) => `${point.id}`,
		itemScope: key => key,
		collectSinks: instances => ({
			point: instances.pickCombine('point')
		})
	});
	return PointCollection(sources);
};

type ColorState = {
	colors: string[]
}
type ColorSources = {
	DOM: DOMSource,
	onion: StateSource<ColorState>
}
type ColorSinks = {
	DOM: Stream<VNode>,
	color$: Stream<number>
}
function Colors(sources: ColorSources): ColorSinks {
	const state$ = sources.onion.state$;
	const selectedColor$ = sources.DOM
		.select('.color-block')
		.events('click')
		.map(e => {
			e.stopPropagation();
			return parseInt(e.target.dataset['colorIndex']);
		});

	const vdom$ = state$.map(({colors}) => {
		return div([
				'Player color:',
				...colors.map((color, idx) => div(
					'.color-block',
					{attrs:
						{
							'data-color-index': idx,
							style: `background-color: ${color};`
						}
					}))
		]);
	});

	return {
		DOM: vdom$,
		color$: selectedColor$
	};
};

type Scale = {width: number, height: number, scale: number};
function scale({w}: {w: number}): Scale;
function scale({h}: {h: number}): Scale;
function scale(i: any): Scale {
	if (i.w !== undefined) {
		return {
			width: i.w, 
			height: FIELD_HEIGHT * i.w / FIELD_WIDTH,
			scale: i.w / FIELD_WIDTH
		};
	} else if (i.h !== undefined) {
		const width = i.h * FIELD_WIDTH / FIELD_HEIGHT;
		return {
			height: i.h, 
			width,
			scale: width / FIELD_WIDTH
		};
	} else {
		throw new Error(`Invalid input ${i}`);
	}
}

const toField: (Position) => Position = ({x, y}) => ({
	x: (x + FIELD_WIDTH / 2) * FIELD_SCALE,
	y: (y + FIELD_HEIGHT / 2) * FIELD_SCALE
});
const fromField: (Position) => Position = ({x, y}) => ({
	x: (x - FIELD_WIDTH / 2) / FIELD_SCALE,
	y: (y - FIELD_HEIGHT / 2) / FIELD_SCALE
});
const fieldViewPort = (type: FieldType): ViewPort => {
	const height = FIELD_HEIGHT * FIELD_SCALE;
	const width = FIELD_WIDTH * FIELD_SCALE;
	switch (type) {
		case 'full': return {x: 0, y: 0, width, height};
		case 'middle': return {x: 0, y: 0.25 * height, width, height: 0.5 * height};
		case 'up-zone': return {x: 0, y: 0, width, height: 0.45 * height};
		case 'down-zone': return {x: 0, y: 0.55 * height, width, height: 0.45 * height};
		default: throw new Error(`Unknown field type ${type}`);
	}
};
const fieldSize = (type: FieldType): Scale => {
	const {width, height, scale: s} = scale({h: 400});
	switch (type) {
		case 'full': return {width, height, scale: s};
		case 'middle': return {
			width: width / 0.5,
			height,
			scale: s / 0.5
		};
		case 'up-zone':
		case 'down-zone': return {
			width: width / 0.45,
			height,
			scale: s / 0.45
		};
		default: throw new Error(`Unknown field type ${type}`);
	}
};

const extractScaledPosition = (e: MouseEvent) => {
	e.stopPropagation();
	const canvas = e.srcElement as HTMLCanvasElement;
	const factor = canvas.width / FIELD_WIDTH;
	return {
		x: e.offsetX / factor,
		y: e.offsetY / factor
	};
};
const adaptOrigin = (fieldType: FieldType) => {
	const {x, y} = fieldViewPort(fieldType);
	return (position) => ({
		...position,
		x: position.x + x,
		y: position.y + y
	});
};
const resizeToState = (state$: Stream<State>, position$: Stream<MouseEvent>): Stream<Position> => {
	return state$.map(({fieldType}) => {
		return position$
			.map(extractScaledPosition)
			.map(adaptOrigin(fieldType))
			.map(fromField);
	})
	.flatten();
}
const associateSelected = (state$: Stream<State>, position$: Stream<Position>) => state$.map(({points}) => {
	return position$.map((position) => {
		const selected = points.find(p => {
			return Math.abs(p.x - position.x) <= 10
				&& Math.abs(p.y - position.y) <= 10;
		});
		return {
			...position, 
			id: selected !== undefined ? selected.id : null
		};
	});
})
.flatten();

type State = {
	colors: string[],
	selected: PlayerId,
	fieldType: FieldType,
	points: Player[]
};
type Sources<S> = {
	DOM: DOMSource,
	onion: StateSource<S>
};
type Sinks<S> = {
	DOM: Stream<VNode>,
	onion: Stream<Reducer<S>>,
	canvas: Stream<CanvasDescription>
};
function Field(sources: Sources<State>): Sinks<State> {
	const state$ = sources.onion.state$;
	const canvas$ = sources.DOM.select('canvas');

	const cDblClick$ = resizeToState(state$, canvas$.events('dblclick'));
	const cDown$ = resizeToState(state$, canvas$.events('mousedown'));
	const cMove$ = resizeToState(state$, canvas$.events('mousemove'));
	const cUp$ = canvas$.events('mouseup')
		.map(extractScaledPosition);
	const cLeave$ = canvas$.events('mouseleave')
			.map(extractScaledPosition);

	const selectedStart$ = associateSelected(state$, cDown$)
		.filter(p => p.id !== null);

	const dblClick$ = cDblClick$;
	const endDrag$ = xs.merge(cUp$, cLeave$);

	const newPlayerReducer$ = dblClick$.map(
		position => (state: State) => {
			const points = state.points.slice();
			const id =  generatePlayerId(points);
			points.push(
				createPlayer({...position, id}));
			return {...state, points, selected: id};
		});
	
	const stateUpdate$ = selectedStart$.map(({id}) => {
			return cMove$.map(p => ({...p, id}))
				.endWhen(endDrag$);
		})
		.flatten();
	const positionReducer$ = stateUpdate$.map(update => state => updatePlayerState(state, update));
	
	const selectedReducer$ = selectedStart$
		.map(({id}) => (state: State) => Object.assign({}, state, {selected: id}));

	// Resolve colors and points into a single array
	const pointsLens = {
		get({points, colors, selected, fieldType}: State): PointItemState[] {
			return points.map(p => ({
				...p,
				color: colors[p.color],
				selected: p.id === selected,
				fieldType
			}));
		},
		set(state: State, childState): State {
			return state; // No change
		}
	};
	const points = isolate(Points, pointsLens)(sources) as PointSinks<(Drawing | null)[]>;

	const colorLens = {
		get({colors}: State): ColorState {
			return {colors};
		},
		set(state: State, _: ColorState): State {
			return state // No change
		}
	};
	const colors = isolate(Colors, colorLens)(sources) as ColorSinks;
	const colorReducer$ = colors.color$.map(idx => (state: State) => {
		if (state.selected) {
			const points = state.points.slice();
			const selectedPoint = points.find(p => p.id === state.selected);
			selectedPoint.color = idx;
			return Object.assign({}, state, {points});
		} else {
			return state;
		}
	});

	const modeLens = {
		get({fieldType: selected}: State): ModeState {
			const modes: FieldType[] = [
				'full',
				'middle',
				'up-zone',
				'down-zone'
			];
			return {
				modes: modes,
				selected
			};
		},
		set(state: State, {selected}: ModeState): State {
			return {
				...state,
				fieldType: selected as FieldType
			};
		}
	};
	const modes = isolate(ModeButtons, modeLens)(sources) as ModeSinks<State>;

	const deletePlayer = isolate(Button)({
		DOM: sources.DOM,
		props$: xs.of({text: 'Delete player'}).remember()
	});
	const deletePlayerReducer$ = deletePlayer.click$.map(
		() => (state: State) => {
			// Remove selected from the list
			const points = state.points.slice();
			const idx = points.findIndex(p => p.id === state.selected);
			if (idx >= 0) {
				points.splice(idx, 1);
			}
			return {...state, points, selected: null};
		});

	const closeButton = isolate(Button)({
		DOM: sources.DOM,
		props$: xs.of({text: 'Close'}).remember()
	});
	const closeReducer$ = closeButton.click$.map(
		() => (state: State) => ({...state, selected: null}));

	const reducer$ = xs.merge(
		positionReducer$,
		selectedReducer$,
		colorReducer$,
		modes.onion,
		newPlayerReducer$,
		deletePlayerReducer$,
		closeReducer$);

	const fieldBorder$ = state$.map(({fieldType}) => makeField(fieldType));

	const canvasDraws$ = xs.combine(
			points.point.map(ps => Object.entries(ps)
				.filter(([key, p]) => !isNaN(parseInt(key)) && p !== null)
				.map(([_, p]) => p)),
			fieldBorder$)
		.map(([elements, borders]) => ({
			id: 'field-canvas',
			drawings: [
				// Borders first to have points above
				...borders, 
				...elements
			]
		}));

	const vdom$ = xs.combine(
			state$,
			// points.DOM,
			colors.DOM,
			modes.DOM,
			deletePlayer.DOM,
			closeButton.DOM)
		.map(([{selected, fieldType}/*, elements*/, colors, modes, deletePlayer]) => {
			const elementsOnSelected = selected
				? [colors, deletePlayer]
				: [];

			const {width, height} = fieldSize(fieldType);
			return div(
				'.field',
				[
					modes,
					h(
						'canvas',
						{
							attrs:{
								id: 'field-canvas',
								width,
								height
							}
						}),
					...elementsOnSelected
				]);
		})
		.replaceError(errorView('field'));

	return {
		DOM: vdom$,
		onion: reducer$,
		canvas: canvasDraws$
	};
}

export {
	State,
	Sources,
	Sinks,
	Field
}
