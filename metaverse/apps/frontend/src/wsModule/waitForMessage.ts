export function waitForMessage<T>(
  ws: WebSocket,
  type: string
): Promise<T> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);

      if (msg.type === type) {
        ws.removeEventListener("message", listener); 
        resolve(msg as T);
      }
    };

    ws.addEventListener("message", listener);
  });
}
