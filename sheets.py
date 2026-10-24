import gspread
from google.oauth2.service_account import Credentials
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Локальный кэш на случай сбоя Google API
_CATALOG_CACHE: List[Dict[str, Any]] = []

def get_sheets_client():
    scopes = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    # credentials.json монтируется из настроек хостинга
    creds = Credentials.from_service_account_file("credentials.json", scopes=scopes)
    return gspread.authorize(creds)

def fetch_catalog(spreadsheet_id: str) -> List[Dict[str, Any]]:
    global _CATALOG_CACHE
    try:
        client = get_sheets_client()
        sheet = client.open_by_key(spreadsheet_id).worksheet("Каталог")
        records = sheet.get_all_records()
        
        valid_items = []
        for r in records:
            # Читаем только активные позиции с ценой > 0
            if str(r.get("is_active", "")).strip().upper() in ["TRUE", "1", "ДА"]:
                valid_items.append({
                    "id": int(r.get("id", 0)),
                    "title": str(r.get("title", "")),
                    "category": str(r.get("category", "Разное")),
                    "price": float(r.get("price", 0)),
                    "photo_url": str(r.get("photo_url", "")),
                    "description": str(r.get("description", ""))
                })
        _CATALOG_CACHE = valid_items
        return _CATALOG_CACHE
    except Exception as e:
        logger.error(f"Сбой чтения Google Таблицы: {e}. Откат на локальный кэш.")
        return _CATALOG_CACHE
