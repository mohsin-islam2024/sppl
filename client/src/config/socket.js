import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { auth } from "./firebase.js";
import { CLIENT_EVENTS } from "@sppl/shared/constants/socket.js";

/**
 * Socket.IO client.
 *
 * A single shared connection for the whole app: a match page and a points-table
 * widget on the same screen must not open two sockets, and the server broadcasts to
 * rooms rather than to individual sockets anyway.
 *
 * The socket is created lazily on first use and torn down with the last subscriber.
 */
let socket = null;
let subscriberCount = 0;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

function createSocket() {
  const instance = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  instance.on("connect_error", (error) => {
    // Logged rather than surfaced: the page still works from cached REST data, and
    // a toast on every reconnect attempt during a flaky match would be worse.
    console.warn("[socket] connect error", error.message);
  });

  return instance;
}

/** Get (or create) the shared socket instance. */
export function getSocket() {
  if (!socket) socket = createSocket();
  return socket;
}

export function releaseSocket() {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to a match room for the lifetime of a component.
 */
export function useMatchSocket(matchId) {
  const [connected, setConnected] = useState(false);
  const [activeSocket, setActiveSocket] = useState(null);

  useEffect(() => {
    if (!matchId) return undefined;

    const instance = getSocket();
    subscriberCount += 1;
    setActiveSocket(instance);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    if (instance.connected) setConnected(true);

    instance.emit(CLIENT_EVENTS.JOIN_MATCH, { matchId });

    return () => {
      instance.emit(CLIENT_EVENTS.LEAVE_MATCH, { matchId });
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      releaseSocket();
      setActiveSocket(null);
      setConnected(false);
    };
  }, [matchId]);

  return { socket: activeSocket, connected };
}

/**
 * Subscribe to a season room (points table, announcements).
 */
export function useSeasonSocket(seasonId) {
  const [connected, setConnected] = useState(false);
  const [activeSocket, setActiveSocket] = useState(null);

  useEffect(() => {
    if (!seasonId) return undefined;

    const instance = getSocket();
    subscriberCount += 1;
    setActiveSocket(instance);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    if (instance.connected) setConnected(true);

    instance.emit(CLIENT_EVENTS.JOIN_SEASON, { seasonId });

    return () => {
      instance.emit(CLIENT_EVENTS.LEAVE_SEASON, { seasonId });
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      releaseSocket();
      setActiveSocket(null);
      setConnected(false);
    };
  }, [seasonId]);

  return { socket: activeSocket, connected };
}

/** Id token of the current user, for a future authenticated socket handshake. */
export async function currentSocketToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export default getSocket;
