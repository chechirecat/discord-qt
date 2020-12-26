import { patchClass } from '../utilities/Patcher';

const StreamDispatcher = require('discord.js/src/client/voice/dispatcher/StreamDispatcher');

class StreamDispatcherPatch {
  _sendPacket(this: typeof StreamDispatcher, packet: any) {
    if (!this.player.voiceConnection.sockets.udp) {
      this.emit('debug', 'Failed to send a packet - no UDP socket');

      return;
    }

    this.player.voiceConnection.sockets.udp.send(packet).catch((e: string) => {
      this.emit('debug', `Failed to send a packet - ${e}`);
    });
  }
}

patchClass(StreamDispatcher.prototype, StreamDispatcherPatch);
