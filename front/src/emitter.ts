type Listener = (...args: any[]) => void

export default class Emitter<T extends string> {
	private events: Map<T, Listener[]> = new Map()

	on(event: T, listener: Listener) {
		const listeners = this.events.get(event) || []
		listeners.push(listener)
		this.events.set(event, listeners)
	}

	off(event: T, targetListener: Listener) {
		const listeners = this.events.get(event)
		if (!listeners) return false
		const newListeners = listeners.filter(
			(listener) => listener !== targetListener,
		)
		this.events.set(event, newListeners)
		return true
	}

	emit(event: T, ...args: any[]) {
		const listeners = this.events.get(event)
		if (!listeners) return
		listeners.forEach((listener) => listener(...args))
	}

	clear(event?: T) {
		if (!event) {
			this.events.clear()
			return
		}
		this.events.delete(event)
	}
}
