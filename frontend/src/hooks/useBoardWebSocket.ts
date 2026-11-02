
"use client";

import { useEffect, useRef, useState } from "react";

type BoardEvent = {
  type: string;
  organization_id?: number;
  tenant_id?: number;
  board_id?: number;
  actor_id?: number;
  task?: unknown;
  task_id?: number;
  user_id?: number;
  user_name?: string;
  message?: string;
};

type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type UseBoardWebSocketOptions = {
  organizationId: number | null;
  tenantId: number | null;
  boardId: number | null;
  enabled?: boolean;
  onTaskEvent?: (event: BoardEvent) => void;
};

export function useBoardWebSocket({
  organizationId,
  tenantId,
  boardId,
  enabled = true,
  onTaskEvent,
}: UseBoardWebSocketOptions) {
  const [status, setStatus] =
    useState<ConnectionStatus>("disconnected");

  const callbackRef = useRef(onTaskEvent);

  useEffect(() => {
    callbackRef.current = onTaskEvent;
  }, [onTaskEvent]);

  useEffect(() => {
    if (
      !enabled ||
      organizationId === null ||
      tenantId === null ||
      boardId === null
    ) {
      return;
    }

    const token = localStorage.getItem("collabkanban_token");

    if (!token) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let reconnectAttempts = 0;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    const wsUrl = apiUrl.replace(/^http/, "ws");

    const connect = () => {
      if (stopped) return;

      setStatus(
        reconnectAttempts === 0 ? "connecting" : "reconnecting"
      );

      const url =
        `${wsUrl}/ws/organizations/${organizationId}` +
        `/tenants/${tenantId}/boards/${boardId}` +
        `?token=${encodeURIComponent(token)}`;

      socket = new WebSocket(url);

      socket.onopen = () => {
        reconnectAttempts = 0;
        setStatus("connected");
      };

      socket.onmessage = (message) => {
        try {
          const event: BoardEvent = JSON.parse(message.data);

          if (
            [
              "task_created",
              "task_updated",
              "task_deleted",
            ].includes(event.type)
          ) {
            callbackRef.current?.(event);
          }
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = (event) => {
        if (stopped) return;

        setStatus("disconnected");

        // Do not retry if the server rejected authentication.
        if (event.code === 1008) return;

        reconnectAttempts += 1;

        const delay = Math.min(
          1000 * 2 ** Math.min(reconnectAttempts - 1, 5),
          30000
        );

        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [organizationId, tenantId, boardId, enabled]);

  return { status };
}
