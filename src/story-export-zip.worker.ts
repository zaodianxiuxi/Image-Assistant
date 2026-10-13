import { zipSync } from 'fflate';

self.onmessage = (event: MessageEvent<Record<string, Uint8Array>>) => {
  try {
    const bytes = zipSync(event.data, { level: 0 });
    self.postMessage({ bytes }, { transfer: [bytes.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '图片打包失败。' });
  }
};
