
import asyncio
from collections import defaultdict
from concurrent.futures import TimeoutError

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Each board gets its own room.
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)
        self.lock = asyncio.Lock()
        self.event_loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, room: str, websocket: WebSocket):
        # Store the server's running event loop.
        self.event_loop = asyncio.get_running_loop()

        await websocket.accept()

        async with self.lock:
            self.active_connections[room].append(websocket)

    async def disconnect(self, room: str, websocket: WebSocket):
        async with self.lock:
            if websocket in self.active_connections[room]:
                self.active_connections[room].remove(websocket)

            if not self.active_connections[room]:
                self.active_connections.pop(room, None)

    async def broadcast(self, room: str, message: dict):
        async with self.lock:
            connections = list(self.active_connections.get(room, []))

        disconnected = []

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            await self.disconnect(room, connection)

    def broadcast_sync(self, room: str, message: dict):
        """
        Allows synchronous FastAPI routes to broadcast
        messages through the server's running event loop.
        """
        loop = self.event_loop

        if loop is None or loop.is_closed() or not loop.is_running():
            return False

        future = asyncio.run_coroutine_threadsafe(
            self.broadcast(room, message),
            loop,
        )

        try:
            future.result(timeout=3)
            return True
        except (TimeoutError, Exception):
            future.cancel()
            return False


manager = ConnectionManager()
