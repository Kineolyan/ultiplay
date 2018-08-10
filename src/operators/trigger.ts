import { textarea } from '@cycle/dom';
import xs, {Producer, Stream} from 'xstream';

class TriggerOperator<T> implements Producer<T> {
	private error: Error | undefined;
	private last: T | undefined;
	private isSet: boolean;
	private unregisters: (() => void)[];

	constructor(private source$: Stream<T>, private trigger$: Stream<any>) {
		this.error = undefined;
		this.last = undefined;
		this.isSet = false;
		this.unregisters = [];
	}

	start(listener) {
		const sourceListener = {
			next: (value) => {
				this.last = value;
				this.isSet = true;
			},
			error: (e) => {
				this.error = e;
			}
		};
		const triggerListener = {
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


		this.source$.addListener(sourceListener);
		this.unregisters.push(() => this.source$.removeListener(sourceListener));
		this.trigger$.addListener(triggerListener);
		this.unregisters.push(() => this.trigger$.removeListener(triggerListener));
	}

	stop() {
		this.unregisters.forEach(action => action());
	}
}

function triggerOperator<T>(source$: Stream<T>, trigger$: Stream<any>): Stream<T> {
	return xs.create(new TriggerOperator(source$, trigger$));
}

const trigger: <T>(trigger$: Stream<any>) => (ins: Stream<T>) => Stream<T> =
	trigger$ => source$ => triggerOperator(source$, trigger$);

export {
	triggerOperator,
	trigger
};
