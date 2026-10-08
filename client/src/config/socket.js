import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { auth } from "./firebase.js";
import { CLIENT_EVENTS } from "@sppl/shared/constants/socket.js";

/**
 * Socket.IO client.
 *
 * A single shared connection for the whole app: a match page and a points-table
 * widget on the same screen must not open two sockets.
 *
 * Three details here are load-bearing, and each was wrong in an earlier version:
 *
 *   1. The socket is created ONCE per hook instance with `useMemo`, not held in
 *      state. Storing it in state made it `null` on the first render, so any hook
 *      that depended on `socket` ran its effect against null and never joined its
 *      room. That is why the public score only updated after a reload.
 *
 *   2. The socket is NEVER disconnected by a subscriber. React StrictMode mounts and
 *      unmounts every effect twice in development, so a reference-counted disconnect
 *      ran the count to zero on the first unmount and tore down a connection the
 *      second mount still needed.
 *
 *   3. Joining a room is not a one-shot. A reconnect loses every room, so each
 *      subscription re-joins on `connect`.
 */
let socket = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

function createSocket() {
  const instance = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  instance.on("connect", () => {
    console.info("[socket] connected", instance.id);
  });

  instance.on("connect_error", (error) => {
    console.warn("[socket] connect error", error.message);
  });

  return instance;
}

/** Get (or create) the shared socket instance. */
export function getSocket() {
  if (!socket) socket = createSocket();
  return socket;
}

/**
 * Join a room now, and again after every reconnect.
 *
 * @returns {() => void} cleanup that leaves the room and drops the listener
 */
function subscribeToRoom({ joinEvent, leaveEvent, payload }) {
  const instance = getSocket();

  const join = () => instance.emit(joinEvent, payload);
  const leave = () => instance.emit(leaveEvent, payload);

  // A reconnect drops every room the server had us in, so join again on connect.
  instance.on("connect", join);
  join();

  return () => {
    instance.off("connect", join);
    leave();
  };
}

/**
 * Subscribe to a match room for the lifetime of a component.
 */
export function useMatchSocket(matchId) {
  const [connected, setConnected] = useState(false);

  // Created once, available on the first render — see note 1 above.
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    if (!matchId) return undefined;

    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const unsubscribe = subscribeToRoom({
      joinEvent: CLIENT_EVENTS.JOIN_MATCH,
      leaveEvent: CLIENT_EVENTS.LEAVE_MATCH,
      payload: { matchId },
    });

    return () => {
      unsubscribe();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      setConnected(false);
    };
  }, [socket, matchId]);

  return { socket, connected };
}

/**
 * Subscribe to a season room (points table, announcements).
 */
export function useSeasonSocket(seasonId) {
  const [connected, setConnected] = useState(false);

  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    if (!seasonId) return undefined;

    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const unsubscribe = subscribeToRoom({
      joinEvent: CLIENT_EVENTS.JOIN_SEASON,
      leaveEvent: CLIENT_EVENTS.LEAVE_SEASON,
      payload: { seasonId },
    });

    return () => {
      unsubscribe();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      setConnected(false);
    };
  }, [socket, seasonId]);

  return { socket, connected };
}

/** Id token of the current user, for a future authenticated socket handshake. */
export async function currentSocketToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export default getSocket;
