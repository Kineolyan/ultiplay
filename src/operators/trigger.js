import xs from 'xstream';

const trigger = (source$, trigger$) => xs.create({
	start(listener) {
		// debugger;
		this.sourceListener = {
			next: (value) => {
				this.last = value;
			},
			error: (e) => {
				this.error = e;
			}
		};
		this.triggerListener = {
			next: () => {
				if (this.error !== undefined) {
					listener.next(this.last)
				} else {
					listener.error(this.error);
					this.stop();
				}
			},
			error: (e) => {
				listener.error(e);
				this.stop();
			},
			complete: () => this.stop()
		};

		source$.addListener(this.sourceListener);
		trigger$.addListener(this.triggerListener);
	},
	stop() {
		source$.removeListener(this.sourceListener);
		trigger$.removeListener(this.triggerListener);
	},
	error: undefined,
	last: undefined
});

export {
	trigger
};
