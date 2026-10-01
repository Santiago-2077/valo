"""Usage:
python -m app.cli set-password <username>
python -m app.cli seed-demo [--force]   fill an empty database with demo data"""

import asyncio
import getpass
import sys

from sqlalchemy import select

from app.clock import today
from app.db import SessionLocal
from app.demo import is_empty, seed_demo
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


async def run_seed(force: bool) -> None:
    async with SessionLocal() as session:
        if not force and not await is_empty(session):
            sys.exit("La base ya tiene datos; usá --force si querés agregar la demo igual.")
        counts = await seed_demo(session, today())
    print("Demo cargada: " + ", ".join(f"{v} {k}" for k, v in counts.items()))


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "seed-demo":
        asyncio.run(run_seed(force="--force" in sys.argv[2:]))
        return
    if len(sys.argv) != 3 or sys.argv[1] != "set-password":
        print(__doc__)
        sys.exit(1)
    password = getpass.getpass("Contraseña: ")
    if len(password) < 8:
        sys.exit("La contraseña debe tener al menos 8 caracteres.")
    asyncio.run(set_password(sys.argv[2], password))


if __name__ == "__main__":
    main()
