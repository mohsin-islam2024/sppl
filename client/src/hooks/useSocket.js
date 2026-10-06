import { useEffect, useState } from "react";
import { getSocket } from "../config/socket.js";
import useAuth from "./useAuth.js";

/**
 * Subscribe to one server event for the lifetime of a component.
 *
 * Reading a socket event means the component also has to care about the connection
 * dropping mid-innings, so the hook returns `connected` alongside the payload and
 * lets the caller decide how to present a stale score.
 *
 * @param {string|null} event   server event name from SERVER_EVENTS
 * @param {(payload: any) => void} handler
 * @param {{ enabled?: boolean }} [options]
 */
export function useSocketEvent(event, handler, { enabled = true } = {}) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!event || !enabled) return undefined;

    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(event, handler);
    setConnected(socket.connected);

    return () => {
      socket.off(event, handler);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
    // `handler` is intentionally not a dependency: callers frequently pass an inline
    // function, and re-subscribing on every render would thrash the listener list.
    // A stable handler (useCallback) is the caller's responsibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, enabled]);

  return { connected, isAuthenticated };
}

export default useSocketEvent;
