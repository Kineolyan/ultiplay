import xs from 'xstream';

const triggerOperator = (source$, trigger$) => xs.create({
	start(listener) {
		this.sourceListener = {
			next: (value) => {
				this.last = value;
				this.isSet = true;
			},
			error: (e) => {
				this.error = e;
			}
		};
		this.triggerListener = {
			next: () => {
				if (this.error !== undefined) {
					listener.error(this.error);
					this.stop();
				} else if (this.isSet) {
					this.isSet = false
					listener.next(this.last);
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
	last: undefined,
	isSet: false
});

const trigger = trigger$ => source$ => triggerOperator(source$, trigger$);

export {
	triggerOperator,
	trigger
};
