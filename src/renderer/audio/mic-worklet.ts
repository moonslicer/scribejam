export const MIC_WORKLET_PROCESSOR_SOURCE = `
const FRAME_SIZE = 320;

class MicWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(FRAME_SIZE * 4);
    this.pendingLength = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) {
      return true;
    }

    for (let i = 0; i < input.length; i += 1) {
      if (this.pendingLength >= this.pending.length) {
        this.flush();
      }
      this.pending[this.pendingLength] = input[i];
      this.pendingLength += 1;
      if (this.pendingLength >= FRAME_SIZE) {
        this.flush();
      }
    }

    return true;
  }

  flush() {
    if (this.pendingLength < FRAME_SIZE) {
      return;
    }
    const frame = this.pending.slice(0, FRAME_SIZE);
    this.pending.copyWithin(0, FRAME_SIZE, this.pendingLength);
    this.pendingLength -= FRAME_SIZE;
    this.port.postMessage(frame);
  }
}

registerProcessor('scribejam-mic-worklet', MicWorkletProcessor);
`;
