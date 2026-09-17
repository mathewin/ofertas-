import { EventEmitter } from 'node:events';

class Bus extends EventEmitter {}

const bus = new Bus();
bus.setMaxListeners(100);

export default bus;
