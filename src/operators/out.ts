import {Stream} from 'xstream';

const printStream = (stream: Stream<any>, name = 'dbg') => {
	stream.addListener({
		next: value => console.log('Value for', name, value),
		complete: () => console.log('End of', name),
		error: e => console.error('Error on', name, e)
	});
};

const composablePrint = (name = 'dbg') => (stream: Stream<any>) => {
	printStream(stream, name);
	return stream;
};

export {
	printStream,
	composablePrint
};
