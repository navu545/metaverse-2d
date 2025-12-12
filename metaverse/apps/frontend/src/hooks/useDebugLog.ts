import { useState, useEffect } from "react";


export function useDebugLog(timeout:2000) {

    const [log, setLog] = useState("");

    useEffect(() => {
        const originalLog = console.log

        console.log = (...args) => {
            originalLog(...args);
            setLog(args.join(" "));

            setTimeout(() => {
        setLog("");
      }, timeout);
    }

        return () => {
            console.log = originalLog;
        }
    }, [timeout])

    return log
}