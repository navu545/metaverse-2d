export async function connectWS(spaceId: string, adminToken: string) {
  const WS_URL = "ws://localhost:3001";
  const ws = new WebSocket(WS_URL);

  await new Promise<void>((resolve) => {
    ws.onopen = () => resolve();
  });

  ws.send(
    JSON.stringify({
      type: "join",
      payload: { spaceId, token: adminToken },
    })
  );

  //we send join message to join a space but we'll listen somewhere else to recieve it 

  return ws;
}
