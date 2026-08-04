from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import aiomysql

from .config import Settings
from .redaction import redact


class Database:
    def __init__(self, settings: Settings):
        self.settings = settings

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[Any]:
        self.settings.require_test_database()
        connection = await aiomysql.connect(
            host=self.settings.e2e_db_host,
            port=self.settings.e2e_db_port,
            user=self.settings.e2e_db_user,
            password=self.settings.e2e_db_password.get_secret_value() if self.settings.e2e_db_password else "",
            db=self.settings.e2e_db_name,
            autocommit=False,
        )
        try:
            yield connection
        finally:
            connection.close()

    async def ping(self) -> dict[str, Any]:
        async with self.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT DATABASE(), CURRENT_USER(), 1")
                row = await cursor.fetchone()
            await connection.rollback()
        return redact({"database": row[0], "user": row[1], "ok": row[2] == 1})

    async def read(self, statement: str, params: list[Any] | None = None, *, redact_result: bool = True) -> list[dict[str, Any]]:
        normalized = statement.lstrip().upper()
        if not normalized.startswith(("SELECT", "SHOW", "DESCRIBE", "EXPLAIN")):
            raise ValueError("Preflight only accepts read-only SQL")
        async with self.connection() as connection:
            async with connection.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(statement, params or [])
                rows = list(await cursor.fetchall())
            await connection.rollback()
        return redact(rows) if redact_result else rows
