const printStream = (stream, name = 'dbg') => {
	stream.addListener({
		next: value => console.log('Value for', name, value),
		complete: () => console.log('End of', name),
		error: e => console.error('Error on', name, e)
	});
};

export {
	printStream
};
