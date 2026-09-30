from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.deps import CurrentUser, SessionDep
from app.models import Category, Expense
from app.schemas import HexColor, Money, MoneyIn, ORMModel

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    icon: str = Field(default="tag", max_length=40)
    color: HexColor = "#78716c"
    monthly_budget: MoneyIn | None = None


class CategoryOut(ORMModel):
    id: int
    name: str
    icon: str
    color: str
    monthly_budget: Money | None


async def _get(session: SessionDep, category_id: int) -> Category:
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    return category


async def _commit(session: SessionDep) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ya existe una categoría con ese nombre"
        ) from exc


@router.get("", response_model=list[CategoryOut])
async def list_categories(session: SessionDep, _: CurrentUser) -> list[Category]:
    return list(await session.scalars(select(Category).order_by(Category.name)))


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryIn, session: SessionDep, _: CurrentUser) -> Category:
    category = Category(**data.model_dump())
    session.add(category)
    await _commit(session)
    return category


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int, data: CategoryIn, session: SessionDep, _: CurrentUser
) -> Category:
    category = await _get(session, category_id)
    for key, value in data.model_dump().items():
        setattr(category, key, value)
    await _commit(session)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, session: SessionDep, _: CurrentUser) -> None:
    """Expenses in this category become uncategorized."""
    category = await _get(session, category_id)
    await session.execute(
        update(Expense).where(Expense.category_id == category_id).values(category_id=None)
    )
    await session.delete(category)
    await session.commit()
