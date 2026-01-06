import type { GameObject } from "./GameObject";

type EventCallBack = {
    id:number;
    eventName:string;
    caller: GameObject;
    callback: (value:unknown) => void;
}

//This class helps us to create, store and manage events. 
class Events {

  callbacks: EventCallBack[] = [];
  nextId = 0;

  //this function scans through the stored event objects and runs the callback function attached on it
  emit(eventName: string, value:unknown) {
    this.callbacks.forEach((stored) => {
      if (stored.eventName === eventName) {
        stored.callback(value);
      }
    });
  }

  /*this function creates an event and stores it in the callbacks list while returning an event id which can be used to turn off/delete that event*/
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

  //this function turns off an event by getting rid of the stored event object from the callbacks list
  off(id: number) {
    this.callbacks = this.callbacks.filter((stored) => stored.id !== id);
  }

  //this function gets rid of all the events attach to an object
  unsubscribe(caller: GameObject) {
    this.callbacks = this.callbacks.filter(
      (stored) => stored.caller !== caller
    );
  }
}

export const events = new Events();
