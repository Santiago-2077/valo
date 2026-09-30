"""Usage: python -m app.cli set-password <username>"""

import asyncio
import getpass
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.security import hash_password


async def set_password(username: str, password: str) -> None:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.username == username))
        if user is None:
            session.add(User(username=username, password_hash=hash_password(password)))
            print(f"Usuario '{username}' creado.")
        else:
            user.password_hash = hash_password(password)
            print(f"Contraseña de '{username}' actualizada.")
        await session.commit()


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] != "set-password":
        print(__doc__)
        sys.exit(1)
    password = getpass.getpass("Contraseña: ")
    if len(password) < 8:
        sys.exit("La contraseña debe tener al menos 8 caracteres.")
    asyncio.run(set_password(sys.argv[2], password))


if __name__ == "__main__":
    main()
