"use client";
import { useCallback, useRef, useState } from "react";
export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef();
  const show = useCallback(m => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(""), 3800); }, []);
  const node = msg ? <div className="toast" role="status" key={msg}>{msg}</div> : null;
  return [show, node];
}
