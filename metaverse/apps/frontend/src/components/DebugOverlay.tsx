import { useDebugLog } from "../hooks/useDebugLog";

//component to display console log on screen
export function DebugOverlay() {

    const log = useDebugLog(2000);

    if(!log) return null;


    return (
      <div className="fixed bottom-2 left-2 bg-black/70 text-white p-2 rounded text-xs z-50">
        {log}
      </div>
    );
}