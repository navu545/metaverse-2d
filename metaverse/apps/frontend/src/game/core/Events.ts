import type { GameObject } from "./GameObject";

type EventCallBack = {
    id:number;
    eventName:string;
    caller: GameObject;
    callback: (value:unknown) => void;
}

class Events {


  callbacks: EventCallBack[] = [];
  nextId = 0;

  emit(eventName: string, value:unknown) {
    this.callbacks.forEach((stored) => {
      if (stored.eventName === eventName) {
        stored.callback(value);
      }
    });
  }

  on(eventName:string, caller:GameObject, callback: (value: unknown) => void) {
    this.nextId += 1;
    this.callbacks.push({
      id: this.nextId,
      eventName,
      caller,
      callback,
    });
    return this.nextId;
  }

  off(id: number) {
    this.callbacks = this.callbacks.filter((stored) => stored.id !== id);
  }

  unsubscribe(caller: GameObject) {
    this.callbacks = this.callbacks.filter(
      (stored) => stored.caller !== caller
    );
  }
}

export const events = new Events();
