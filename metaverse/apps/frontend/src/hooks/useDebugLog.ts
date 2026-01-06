import { useState, useEffect } from "react";

//temporary dev function to display console log on screen

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