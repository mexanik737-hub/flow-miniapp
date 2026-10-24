import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command

import config
import sheets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()

# Локальное хранилище админов и клиентов в памяти процесса
ADMIN_IDS = set()
CLIENTS_DB = {
    # telegram_id: {"card": "FLW-...", "bonuses": 500, "spent": 0, "name": "..."}
}

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user_id = message.from_user.id
    if user_id not in CLIENTS_DB:
        CLIENTS_DB[user_id] = {
            "card": f"FLW-{user_id % 100000:05d}",
            "bonuses": 500,  # 500 стартовых бонусов (100 руб)
            "spent": 0.0,
            "name": message.from_user.full_name or "Клиент"
        }
    await message.answer(
        f"Здравствуйте, {message.from_user.first_name}!\n\n"
        "Добро пожаловать в магазин «Цветы» на Георгиевском проспекте.\n"
        "Вам начислено 500 приветственных бонусов (100 ₽).\n\n"
        "Нажмите кнопку меню внизу, чтобы открыть каталог и бонусную карту."
    )

@dp.message()
async def check_admin_code(message: types.Message):
    text = (message.text or "").strip()
    if text == config.ADMIN_CODE:
        ADMIN_IDS.add(message.from_user.id)
        await message.answer("Доступ администратора активирован. В приложении разблокирован раздел управления.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Фоновый запуск Telegram-бота
    polling_task = asyncio.create_task(dp.start_polling(bot))
    # Прогрев кэша товаров из Google Таблицы
    sheets.fetch_catalog(config.SPREADSHEET_ID)
    yield
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)

# Раздача статики Mini App
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

@app.get("/api/catalog")
def get_catalog():
    return sheets.fetch_catalog(config.SPREADSHEET_ID)

@app.get("/api/user/{user_id}")
def get_user(user_id: int):
    if user_id not in CLIENTS_DB:
        CLIENTS_DB[user_id] = {
            "card": f"FLW-{user_id % 100000:05d}",
            "bonuses": 500,
            "spent": 0.0,
            "name": "Гость"
        }
    data = CLIENTS_DB[user_id]
    # Расчет текущего % кешбэка
    spent = data["spent"]
    cashback_rate = 5 if spent < 15000 else (7 if spent < 50000 else 10)
    return {
        "user_id": user_id,
        "is_admin": user_id in ADMIN_IDS,
        "card_number": data["card"],
        "bonus_balance": data["bonuses"],
        "ruble_balance": data["bonuses"] // 5,
        "total_spent": spent,
        "cashback_rate": cashback_rate
    }

class CashierOperation(BaseModel):
    user_id: int
    check_amount: float
    redeem_rub: float
    performed_by: int

@app.post("/api/cashier/process")
def process_cashier(op: CashierOperation):
    if op.performed_by not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Нет прав доступа")
    if op.user_id not in CLIENTS_DB:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    
    user = CLIENTS_DB[op.user_id]
    max_redeem_rub = op.check_amount * 0.30
    actual_redeem_rub = min(op.redeem_rub, max_redeem_rub, user["bonuses"] // 5)
    
    # 1. Списание бонусов
    user["bonuses"] -= int(actual_redeem_rub * 5)
    
    # 2. Оплата деньгами
    paid_money = op.check_amount - actual_redeem_rub
    user["spent"] += paid_money
    
    # 3. Начисление нового кешбэка
    rate = 5 if user["spent"] < 15000 else (7 if user["spent"] < 50000 else 10)
    accrued_rub = (paid_money * rate) / 100.0
    accrued_bonuses = int(accrued_rub * 5)
    user["bonuses"] += accrued_bonuses
    
    return {
        "success": True,
        "paid_money": paid_money,
        "redeemed_rub": actual_redeem_rub,
        "accrued_bonuses": accrued_bonuses,
        "new_balance": user["bonuses"]
    }
