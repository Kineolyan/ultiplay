import xs, {Stream} from 'xstream';
import {h, div, DOMSource, VNode} from '@cycle/dom';
import {makeCollection, StateSource, Reducer} from 'cycle-onionify';

import {trigger} from '../operators/trigger';
import {createPlayer, generatePlayerId, PlayerId, Player} from './players';
import {Button, ModeButtons, ModeState, ModeSinks} from './buttons';
import {FieldType} from '../state/initial';
import isolate from '../ext/re-isolate';
import { errorView } from '../operators/errors';
import { CanvasDescription, Drawing, Circle, Rect } from '../driver/canvas';
import { composablePrint } from '../operators/out';

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

function getMousePosition(svg, evt) {
	var CTM = svg.getScreenCTM();
	return {
		x: (evt.clientX - CTM.e) / CTM.a,
		y: (evt.clientY - CTM.f) / CTM.d
	};
}

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
	// DOM: Stream<E>,
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
		stroke: selected ? 3 : 1
	};
};

function Point(sources: PointSources<PointItemState>): PointSinks<Drawing | null> {
	const state$ = sources.onion.state$;
	// const vdom$ = state$.map(makePoint);
	const point$ = state$
		.compose(composablePrint('point-state'))
		.map(p => {
			const ap = toViewPort(fieldViewPort(p.fieldType), p);
			return ap ? drawPoint(ap) : null;
		});
		// .filter(p => p !== null)
		// .map(drawPoint);
	return {
		// DOM: vdom$,
		point: point$
	};
};

function Points(sources: PointSources<PointItemState[]>): PointSinks<(Drawing | null)[]> {
	const PointCollection = makeCollection({
		item: Point,
		itemKey: (point: PointItemState, index) => `${point.id}`,
		itemScope: key => key,
		collectSinks: instances => ({
			// DOM: instances.pickCombine('DOM')
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

const onDraggable: <T extends Event>(s: Stream<T>) => Stream<T> =
	(stream) => stream.filter(e => e.target.classList.contains('draggable'));

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
const toViewPortStr = ({x, y, height, width}: ViewPort): string => 
	`${x} ${y} ${width} ${height}`;
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
	const svg$ = sources.DOM.select('svg');
	const startDrag$ = svg$.events('mousedown')
		.compose(onDraggable);
	const onDrag$ = svg$.events('mousemove');
	const endDrag$ = xs.merge(
			svg$.events('mouseup'),
			svg$.events('mouseleave').debug('leave'));
	const dblClick$ = svg$.events('dblclick')
		.map(e => {
			e.preventDefault();
			const position = getMousePosition(e.ownerTarget, e);
			return fromField(position);
		});
	const newPlayerReducer$ = dblClick$.map(
		position => (state: State) => {
			const points = state.points.slice();
			const id =  generatePlayerId(points);
			points.push(
				createPlayer({...position, id}));
			return {...state, points, selected: id};
		});

	const basePosition$ = startDrag$.map(e => {
		const svg = e.ownerTarget;
		const elt = e.target;
		const offset = getMousePosition(svg, e);
		offset.x -= parseFloat(elt.getAttributeNS(null, 'cx'));
		offset.y -= parseFloat(elt.getAttributeNS(null, 'cy'));

		return {element: elt, offset};
	});
	const svgPosition$ = onDrag$.map(e => {
		e.preventDefault();
		const svg = e.ownerTarget;
		return getMousePosition(svg, e);
	});
	// FIXME always force a listener for the svg position (to be able to use endWhen)
	svgPosition$.addListener({});

	const position$ = basePosition$
		.map(({element, offset}) => {
			const id = parseInt(element.getAttributeNS(null, 'cid'));
			return svgPosition$
				.map(position => ({
					id,
					x: position.x - offset.x,
					y: position.y - offset.y
				}))
				.endWhen(endDrag$);
		})
		.flatten();

	const pointMove$ = basePosition$
		.map(({element}) => {
			return position$
				.map(({x, y}) => {
					element.setAttributeNS(null, 'cx', x);
					element.setAttributeNS(null, 'cy', y);
					return null;
				})
				.endWhen(endDrag$);
		})
		.flatten();
	const stateUpdate$ = position$.compose(trigger(endDrag$))
		.map((point) => {
			const position = fromField(point);
			return {
				...point,
				...position
			};
		});
	const positionReducer$ = stateUpdate$.map(update => state => updatePlayerState(state, update));

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
	const selectedReducer$ = startDrag$
		.map(e => parseInt(e.target.dataset['id']))
		.map(id => (state: State) => Object.assign({}, state, {selected: id}));

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

	const state$ = sources.onion.state$;

	const fieldBorder$ = state$.map(({fieldType}) => makeField(fieldType));

	const canvas$ = xs.combine(
			points.point.map(ps => Object.entries(ps)
				.filter(([key, p]) => !isNaN(parseInt(key)) && p !== null)
				.map(([_, p]) => p)),
			fieldBorder$)
		.map(([elements, borders]) => ({
			id: 'field-canvas',
			drawings: [...elements, ...borders]
		}));

	const vdom$ = xs.combine(
			state$,
			// points.DOM,
			colors.DOM,
			modes.DOM,
			deletePlayer.DOM,
			closeButton.DOM,
			pointMove$.startWith(null))
		.map(([{selected, fieldType}/*, elements*/, colors, modes, deletePlayer, closeDOM]) => {
			const elementsOnSelected = selected
				? [colors, deletePlayer, closeDOM]
				: [];
			// const elts = Object.entries(elements)
			// 	.filter(([key, _]) => !isNaN(parseInt(key)))
			// 	.map(([_, dom]) => dom);

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
					// h(
					// 	'svg',
					// 	{attrs: {
					// 		width,
					// 		height,
					// 		viewBox: toViewPortStr(fieldViewPort(fieldType))
					// 	}},
					// 	[
					// 		...drawField(),
					// 		...elts
					// 	]),
					...elementsOnSelected
				]);
		})
		.replaceError(errorView('field'));

	return {
		DOM: vdom$,
		onion: reducer$,
		canvas: canvas$
	};
}

export {
	State,
	Sources,
	Sinks,
	Field
}
