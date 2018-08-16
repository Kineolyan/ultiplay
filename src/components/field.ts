import xs, {Stream} from 'xstream';
import {h, div, button} from '@cycle/dom';
import {makeCollection} from 'cycle-onionify';
import isolate from '@cycle/isolate';

import {trigger} from '../operators/trigger';
import {printStream} from '../operators/out';
import {createPlayer, generatePlayerId} from './players';
import {Button} from './buttons';

function getMousePosition(svg, evt) {
	var CTM = svg.getScreenCTM();
	return {
		x: (evt.clientX - CTM.e) / CTM.a,
		y: (evt.clientY - CTM.f) / CTM.d
	};
}

const createCombobject = (acc, v) => {
	if (v === 1 || v === -1) {
		return Object.assign({}, acc, {trigger: v});
	} else {
		return Object.assign({}, acc, {payload: v});
	}
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
	selected: boolean
};

const updatePlayerState = (state, value: PointState) => {
	const {points} = state;
	const idx = points.findIndex(v => v.id === value.id);
	const copy = [...points];
	copy[idx] = Object.assign(copy[idx], value);
	return Object.assign({}, state, {points: copy});
};

const makePoint = point => h(
	'circle.draggable.player',
	{attrs: {
		'data-id': point.id,
		cx: 150 + point.x,
		cy: 150 + point.y,
		r: 15,
		stroke: 'black',
		'stroke-width': point.selected ? 2 : 1,
		fill: point.color,
		draggable: 'true',
		cid: point.id
	}});

const Point = (sources) => {
	const state$ = sources.onion.state$;
	const vdom$ = state$.map(makePoint);

	return {
		DOM: vdom$
	};
};

const Points = (sources) => {
	const PointCollection = makeCollection({
		item: Point,
		itemKey: (point: PointItemState, index) => `${point.id}`,
		itemScope: key => key,
		collectSinks: instances => ({
			DOM: instances.pickCombine('DOM')
		})
	});
	return PointCollection(sources);
};

const Colors = (sources) => {
	const state$ = sources.onion.state$;
	const selectedColor$ = sources.DOM
		.select('.color-block')
		.events('click')
		.map(e => {
			e.stopPropagation();
			return parseInt(e.srcElement.dataset['colorIndex']);
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

const onDraggable = (stream) => stream.filter(e => e.target.classList.contains('draggable'));

const normalizePosition = (position) => {
	position.x -= 150;
	position.y -= 150;
	return position;
};

const Field = (sources) => {
	const svg$ = sources.DOM.select('svg');
	const startDrag$ = svg$.events('mousedown')
		.compose(onDraggable);
	const onDrag$ = svg$.events('mousemove');
	const endDrag$ = svg$.events('mouseup')
		.compose(onDraggable);
	const dblClick$ = svg$.events('dblclick')
		.map(e => {
			e.preventDefault();
			return normalizePosition({
				x: e.offsetX,
				y: e.offsetY
			});
		});
	const newPlayerReducer$ = dblClick$.map(
		position => state => {
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
		.map((point) => normalizePosition(point));
	const positionReducer$ = stateUpdate$.map(update => state => updatePlayerState(state, update));

	// Resolve colors and points into a single array
	const pointsLens = {
		get: ({points, colors, selected}) => points.map(p => Object.assign(
			{},
			p,
			{
				color: colors[p.color],
				selected: p.id === selected
			})),
		set: (state) => state // No change
	};
	const points: {DOM: Stream<any[]>} = isolate(Points, {onion: pointsLens})(sources);
	const selectedReducer$ = startDrag$
		.map(e => parseInt(e.srcElement.dataset['id']))
		.map(id => state => Object.assign({}, state, {selected: id}));

	const colorLens = {
		get: ({colors}) => ({colors}),
		set: (state) => state // No change
	};
	const colors = isolate(Colors, {onion: colorLens})(sources);
	const colorReducer$ = colors.color$.map(idx => state => {
		if (state.selected) {
			const points = state.points.slice();
			const selectedPoint = points.find(p => p.id === state.selected);
			selectedPoint.color = idx;
			return Object.assign({}, state, {points});
		} else {
			return state;
		}
	});

	const deletePlayer = isolate(Button)({
		DOM: sources.DOM,
		props$: xs.of({text: 'Delete player'}).remember()
	});
	const deletePlayerReducer$ = deletePlayer.click$.map(
		() => state => {
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
		() => state => ({...state, selected: null}));

	const reducer$ = xs.merge(
		positionReducer$, 
		selectedReducer$, 
		colorReducer$, 
		newPlayerReducer$, 
		deletePlayerReducer$,
		closeReducer$);

	const state$ = sources.onion.state$;
	const vdom$ = xs.combine(
			state$, 
			points.DOM, 
			colors.DOM, 
			deletePlayer.DOM, 
			closeButton.DOM,
			pointMove$.startWith(null))
		.map(([{selected}, elements, colors, deletePlayer, closeDOM]) => {
			const elementsOnSelected = selected
				? [colors, deletePlayer, closeDOM]
				: [];
		
			return div(
				'#field',
				[
					h(
						'svg',
						{attrs: {width: 300, height: 300}},
						elements),
					...elementsOnSelected
				]);
		})
		.remember();

	return {
		DOM: vdom$,
		onion: reducer$
	};
}

export {
	Field
}
