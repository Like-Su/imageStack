type MessageType = "success" | "error" | "info" | "warning"
interface MessagePayload {
  type: MessageType
  content: string
}

type Listener = (...args: any[]) => void

export class Emitter {
  private events: Map<string, Listener[]> = new Map()

  on(event: string, listener: Listener) {
    const listeners = this.events.get(event) || []
    listeners.push(listener)
    this.events.set(event, listeners)
  }

  off(event: string, targetListener: Listener) {
    const listeners = this.events.get(event)
    if (!listeners) return false
    const newListeners = listeners.filter(
      (listener) => listener !== targetListener,
    )
    this.events.set(event, newListeners)
    return true
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.events.get(event)
    if (!listeners) return
    listeners.forEach((listener) => listener(...args))
  }

  clear(event?: string) {
    if (!event) {
      this.events.clear()
      return
    }
    this.events.delete(event)
  }
}
