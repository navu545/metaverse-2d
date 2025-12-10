import { useState, useEffect } from "react";

export default function ChatBox({ ws, sessionId, userName }: { ws: WebSocket, sessionId: string, userName:string }) {
  
    const [messages, setMessages] = useState<{name:string, text:string}[]>([]);
    const [input, setInput] = useState("");


    useEffect(()=>{

        if(!ws){
            console.log(ws)
            return;
        }

        function handleMsg(event:MessageEvent) {
            const msg = JSON.parse(event.data);

            if (msg.type === "inbox-message"){
                setMessages(prev => [...prev, {name:msg.payload.userName,text:msg.payload.text}])
            }
        }

        ws.addEventListener('message', handleMsg);

        return () => ws.removeEventListener("message", handleMsg)

    },[ws])

    function send() {

        if (!ws) return; 
        if (!input.trim()) return;

        ws.send(JSON.stringify({
            type:'chat-message',
            payload:{
                sessionId:sessionId,
                message:input,
                userName:userName
            }
        }))
        setMessages((prev) => [...prev, {name:userName, text:input}]);
        setInput("");
        console.log("message sent")
    }


    return (
      <div className="fixed bottom-4 right-4 w-72 h-80 bg-gray-800/80 text-white rounded-lg p-3 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
          {messages.map((m, i) => (
            <div key={i}>
              <span className="font-semibold text-blue-300">{m.name}: </span>
              <span>{m.text}</span>
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
