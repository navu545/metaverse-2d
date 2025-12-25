import { useState, useEffect, useRef } from "react";


type ChatItem = {
  type: "message" | "notification";
  name: string;
  text: string;
};

const NAME_COLORS = [
  "text-red-400",
  "text-blue-400",
  "text-green-400",
  "text-yellow-400",
  "text-purple-400",
  "text-pink-400",
  "text-indigo-400",
  "text-teal-400",
];

function getColorClass(name: string) {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

export default function ChatBox({ ws, sessionId, userName, chatAdmin}: { ws: WebSocket, sessionId: string, userName:string, chatAdmin:string }) {

    const [chatLog, setChatLog] = useState<ChatItem[]>([{type: "notification", name:chatAdmin, text:" is the Admin!"}])
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(()=>{

        if(!ws){
            console.log(ws)
            return;
        }

        function handleMsg(event: MessageEvent) {
          const msg = JSON.parse(event.data);

          if (msg.type === "inbox-message") {
            setChatLog((prev) => [
              ...prev,
              {
                type: "message",
                name: msg.payload.userName,
                text: msg.payload.text,
              },
            ]);
          }

          if (msg.type === "user-left-chat") {
            setChatLog((prev) => [
              ...prev,
              {
                type: "notification",
                name: msg.payload.userName,
                text: " left the chat!",
              },
            ]);
          }

          if (msg.type === "new-user-joined") {
            setChatLog((prev) => [
              ...prev,
              {
                type: "notification",
                name: msg.payload.userName,
                text: " joined the chat!",
              },
            ]);
          }
        }


        ws.addEventListener('message', handleMsg);

        return () => ws.removeEventListener("message", handleMsg)

    },[ws])

    useEffect(() => {
      if (!scrollRef.current) return;

      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatLog]);

    function send() {
      if (!ws || !input.trim()) return;

      ws.send(
        JSON.stringify({
          type: "chat-message",
          payload: {
            sessionId,
            message: input,
            userName,
          },
        })
      );

      setChatLog((prev) => [
        ...prev,
        { type: "message", name: userName, text: input },
      ]);

      setInput("");
    }



    return (
      <div className="fixed bottom-4 right-4 w-72 h-80 bg-gray-800/80 text-white rounded-lg p-3 flex flex-col">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 mb-2 pr-1"
        >
          {chatLog.map((item, i) => (
            <div key={i} className="break-words whitespace-pre-wrap text-sm">
              {item.type === "notification" ? (
                <>
                  <span className="font-semibold text-green-300">
                    {item.name}
                  </span>
                  <span>{item.text}</span>
                </>
              ) : (
                <>
                  <span className={`font-semibold ${getColorClass(item.name)}`}>
                    {item.name}:
                  </span>{" "}
                  <span>{item.text}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <input
          className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              send();
            }
          }}
        ></input>
        <button
          className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
          onClick={send}
        >
          Send
        </button>
      </div>
    );
}
