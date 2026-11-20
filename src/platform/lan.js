import { relayUrl } from './relay-url.js';

const attacks = { j: 'light', k: 'heavy', l: 'kick', u: 'closeSkill', i: 'rangedSkill', o: 'ultimate' };

export function lanSocket(query) {
  const url = new URL('/lan', relayUrl || location.href);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  url.search = new URLSearchParams(query);
  return new WebSocket(url);
}

function inputState() {
  const held = new Set();
  let attack, action, jump;
  return {
    set(button, down) {
      if (!down) {
        held.delete(button);
        return;
      }
      if (held.has(button)) return;
      held.add(button);
      if (attacks[button]) attack = attacks[button];
      if (button === 'w') jump = true;
      if (button === 'q') action = 'dash';
      if (button === 'enhanced') action = 'enhancedDash';
      if (button === 'r') action = 'roll';
      if (button === 'g') action = 'awaken';
      if (button === 't') action = 'escape';
    },
    clear() {
      held.clear();
      attack = action = undefined;
      jump = false;
    },
    consume() {
      const input = { direction: Number(held.has('d')) - Number(held.has('a')),
        charge: held.has('f'), crouch: held.has('s'), guard: held.has('p'), jump, attack, action };
      attack = action = undefined;
      jump = false;
      return input;
    },
  };
}

export function mergeInputs(local, remote) {
  return {
    direction: local.direction || remote.direction,
    charge: local.charge || remote.charge,
    crouch: local.crouch || remote.crouch,
    guard: local.guard || remote.guard,
    jump: local.jump || remote.jump,
    attack: local.attack ?? remote.attack,
    action: local.action ?? remote.action,
  };
}

export function createLanHost({ onRoom, onStatus, onClose, canPlay }) {
  const inputs = [inputState(), inputState()];
  let socket;
  function clear() { inputs.forEach(input => input.clear()); }
  function close() {
    const previous = socket;
    socket = undefined;
    previous?.close();
    clear();
  }
  return {
    open({ solo = false } = {}) {
      close();
      const connection = socket = lanSocket(solo ? { role: 'host', solo: '1' } : { role: 'host' });
      connection.onmessage = ({ data }) => {
        if (socket !== connection) return;
        const message = JSON.parse(data);
        if (message.type === 'room') onRoom(message.options);
        if (message.type === 'status') onStatus(message.connected);
        const input = inputs[message.player - 1];
        if (message.type === 'reset') input?.clear();
        if (message.type === 'input' && canPlay()) input?.set(message.button, message.down);
      };
      connection.onclose = () => {
        if (socket !== connection) return;
        close();
        onClose();
      };
    },
    close, clear,
    consume: index => inputs[index].consume(),
  };
}
