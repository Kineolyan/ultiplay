import xs from 'xstream';
import {h, div} from '@cycle/dom';
import {makeCollection} from 'cycle-onionify';
import isolate from '@cycle/isolate';

import {trigger} from '../operators/trigger.js';

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

const updatePlayerState = (state, value) => {
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
		itemKey: (pointState, index) => pointState.id,
		itemScope: key => key,
		collectSinks: instances => ({
			DOM: instances.pickCombine('DOM')
		})
	});
	return PointCollection(sources);
};

const Colors = (sources) => {
	const state$ = sources.onion.state$;
	const selectedColor$ = sources.DOM.events('click')
		.filter(e => e.srcElement.className === 'color-block')
		.map(e => {
			e.stopPropagation();
			return parseInt(e.srcElement.dataset['colorIndex']);
		});

	const vdom$ = state$.map(({colors, selected}) => {
		if (selected) {
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
		} else {
			return undefined;
		}
	});

	return {
		DOM: vdom$,
		color$: selectedColor$
	};
};

const onDraggable = (stream) => stream.filter(e => e.target.classList.contains('draggable'));

const Field = (sources) => {
	const svg$ = sources.DOM.select('svg');
	const startDrag$ = svg$.events('mousedown').compose(onDraggable);
	const onDrag$ = svg$.events('mousemove');
	const endDrag$ = svg$.events('mouseup').compose(onDraggable);

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
	const position$ = basePosition$
		.map(({element, offset}) => {
			const id = element.getAttributeNS(null, 'cid');
			return svgPosition$
				.map(position => ({
					id,
					x: position.x - offset.x,
					y: position.y - offset.y
				}));
				// .endWhen(endDrag$);
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
			point.x -= 150;
			point.y -= 150;

			return point;
		});
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
	const points = isolate(Points, {onion: pointsLens})(sources);
	const selectedReducer$ = startDrag$
		.map(e => e.srcElement.dataset['id'])
		.map(id => state => Object.assign({}, state, {selected: id}));

	const colorLens = {
		get: ({colors, selected}) => ({colors, selected}),
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
	})

	const reducer$ = xs.merge(positionReducer$, selectedReducer$, colorReducer$);

	const vdom$ = xs.combine(points.DOM, colors.DOM, pointMove$.startWith(null))
		.map(([elements, colors]) =>
			div(
				'#field',
				[
					div('2D Field'),
					h(
						'svg',
						{attrs: {width: 300, height: 300}},
						elements),
					colors
				]))
		.remember();

	return {
		DOM: vdom$,
		onion: reducer$
	};
}

export {
	Field
}
