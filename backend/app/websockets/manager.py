from fastapi import WebSocket
from collections import defaultdict
import asyncio


class ConnectionManager:
    def __init__(self):
        # Each board gets its own room.
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket):
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


manager = ConnectionManager()