import xs from 'xstream';
import {h, div} from '@cycle/dom';

function getMousePosition(svg, evt) {
  var CTM = svg.getScreenCTM();
  return {
    x: (evt.clientX - CTM.e) / CTM.a,
    y: (evt.clientY - CTM.f) / CTM.d
  };
}

const Field = (sources) => {
  const svg$ = sources.DOM.select('svg');
  const startDrag$ = svg$.events('mousedown')
    .filter(e => e.target.classList.contains('draggable'))
    .map(e => {
      const svg = e.ownerTarget;
      const elt = e.target;
      const offset = getMousePosition(svg, e);
      offset.x -= parseFloat(elt.getAttributeNS(null, 'cx'));
      offset.y -= parseFloat(elt.getAttributeNS(null, 'cy'));

      return {element: elt, offset};
    })
    .debug('down');
  const dragEnd$ = svg$.events('mouseup');
  const onDrag$ = svg$.events('mousemove')
    .map(e => {
      e.preventDefault();
      const svg = e.ownerTarget;
      return getMousePosition(svg, e);
    })
    .debug('move');

  const combo$ = startDrag$
    .map(({element, offset}) => {
      const id = element.getAttributeNS(null, 'cid');
      return onDrag$
        .map(position => ({
          id,
          x: position.x - offset.x,
          y: position.y - offset.y
        }))
        .map(position => {
          element.setAttributeNS(null, 'cx', position.x);
          element.setAttributeNS(null, 'cy', position.y);
          return position;
        })
        .endWhen(dragEnd$);
    })
    .flatten()
    .debug()
    .addListener({next: e => console.log('dbg', e)});

  const vdom$ = xs.of(
      div(
        '#field',
        [
          div('2D Field'),
          h(
            'svg',
            {attrs: {width: 300, height: 300}},
            [
              h(
                'circle.draggable',
                {attrs: {
                  cx: 150,
                  cy: 150,
                  r: 15,
                  stroke: 'black',
                  strokeWidth: 1,
                  fill: 'blue',
                  draggable: 'true',
                  cid: 'p-a1'
                }})
            ]
          )]
        ))
    .remember();

	return {
		DOM: vdom$
	};
}

export {
  Field
}
