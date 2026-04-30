from __future__ import annotations
"""
InfraStreet AI Agent — Groq-powered conversation engine.
Vendor flows: Telegram DM (primary MVP path) or Twilio SMS/MMS.
Conversation state in Redis; synthetic vendor phone tg:{chat_id} for Telegram.
"""
import os
import json
import re

try:
    from groq import Groq
    GROQ_OK = True
except ImportError:
    GROQ_OK = False

try:
    import redis
    REDIS_OK = True
except ImportError:
    REDIS_OK = False

from app.db import SessionLocal
from sqlalchemy import text

GROQ_MODEL = "llama-3.3-70b-versatile"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Intent keywords
DEAL_KEYWORDS = {"flash", "deal", "oferta", "promo", "descuento", "precio", "2x1", "%"}
CANCEL_KEYWORDS = {"stop", "cancelar", "cancel"}
YES_KEYWORDS = {"si", "sí", "yes", "ok", "okay", "dale", "sip", "yep", "sure", "confirmar"}
STOP_KEYWORDS = {"stop", "cancelar"}


def _redis():
    if not REDIS_OK:
        return None
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


class AgentService:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        self._groq = Groq(api_key=api_key) if GROQ_OK and api_key else None
        self._redis = _redis()

    # ──────────────────────────────────────────────────────────────
    # Main entry point
    # ──────────────────────────────────────────────────────────────
    async def handle_vendor_message(
        self,
        phone: str,
        text_body: str,
        media_url: str | None = None,
        image_bytes: bytes | None = None,
        telegram_language_code: str | None = None,
    ) -> str:
        vendor = self._get_vendor_by_phone(phone)
        state = self._get_state(phone)

        stored_lang = self._get_lang(phone)
        if stored_lang:
            lang = stored_lang
        elif telegram_language_code:
            lang = "es" if telegram_language_code.startswith("es") else "en"
        else:
            lang = self._detect_lang(text_body)

        low = text_body.strip().lower()
        if low in ("/start", "/help"):
            self._set_lang(phone, lang)
            if vendor:
                return (
                    "Ya estas en InfraStreet. Escribe FLASH para un deal."
                    if lang == "es"
                    else "You're on InfraStreet. Send FLASH to launch a deal."
                )
            return await self._onboard_step1(phone, text_body, telegram_language_code)

        self._set_lang(phone, lang)

        # Photo before we have a vendor record — menu step comes after name/location.
        if not vendor and image_bytes:
            return (
                "Primero el nombre de tu negocio y ubicacion (texto o pin)."
                if lang == "es"
                else "First send your business name and location (text or location pin)."
            )

        # New vendor — continue or start SMS onboarding before a DB record exists.
        if not vendor:
            if state and state.get("step") == "awaiting_name_only":
                return await self._onboard_step_after_pin(phone, text_body, lang)
            if state and state.get("step") == "awaiting_name_location":
                return await self._onboard_step2(phone, text_body, lang)
            return await self._onboard_step1(phone, text_body, telegram_language_code)

        vendor_id = vendor["id"]

        # Cancel active deal
        lower = text_body.strip().lower()
        if any(k in lower for k in CANCEL_KEYWORDS):
            return await self._cancel_active_deal(vendor_id, lang)

        if state and state.get("step") == "awaiting_menu_confirm":
            if any(k in lower for k in YES_KEYWORDS):
                return await self._confirm_menu(phone, vendor_id, lang)
            else:
                return await self._handle_menu_correction(phone, vendor_id, text_body, lang)

        if state and state.get("step") == "awaiting_deal_confirm":
            if any(k in lower for k in YES_KEYWORDS):
                return await self._publish_deal(phone, vendor_id, lang)
            else:
                self._clear_state(phone)
                return "Deal cancelado. Cuando quieras, manda: FLASH [hora] [artículo] [descuento]" if lang == "es" else "Deal cancelled. Send: FLASH [time] [item] [discount]"

        if state and state.get("step") == "awaiting_deal_field":
            return await self._handle_deal_clarification(phone, vendor_id, text_body, lang)

        # Media → menu OCR or deal media
        if media_url or image_bytes:
            return await self._handle_media(phone, vendor_id, media_url, lang, image_bytes=image_bytes)

        # Deal intent
        if self._is_deal_intent(text_body):
            return await self._parse_deal_start(phone, vendor_id, text_body, lang)

        # Free-form → Groq agent
        return await self._groq_response(vendor_id, text_body, lang)

    # ──────────────────────────────────────────────────────────────
    # Onboarding
    # ──────────────────────────────────────────────────────────────
    async def _onboard_step1(
        self, phone: str, text_body: str, telegram_language_code: str | None = None
    ) -> str:
        low = text_body.strip().lower()
        if telegram_language_code and low in ("/start", "/help", ""):
            lang = "es" if telegram_language_code.startswith("es") else "en"
        else:
            lang = self._detect_lang(text_body)
        self._set_lang(phone, lang)
        self._set_state(phone, {"step": "awaiting_name_location"}, ttl=1800)
        if lang == "es":
            return (
                "Hola! Bienvenido a InfraStreet 🌮 Como se llama tu negocio y donde estas? "
                "Manda tu ubicacion o escribe la colonia."
            )
        return (
            "Hey! Welcome to InfraStreet 🌮 What's your business name and location? "
            "Send a pin or type your area."
        )

    async def handle_vendor_location(
        self,
        phone: str,
        lat: float,
        lng: float,
        telegram_language_code: str | None = None,
    ) -> str:
        vendor = self._get_vendor_by_phone(phone)
        if vendor:
            stored_lang = self._get_lang(phone)
            lang = stored_lang or (
                "es" if (telegram_language_code or "").startswith("es") else "en"
            )
            return (
                "Ya estas registrado. Escribe FLASH para un deal."
                if lang == "es"
                else "You're registered. Send FLASH to post a deal."
            )

        stored_lang = self._get_lang(phone)
        if stored_lang:
            lang = stored_lang
        elif telegram_language_code:
            lang = "es" if telegram_language_code.startswith("es") else "en"
        else:
            lang = "es"
        self._set_lang(phone, lang)

        state = self._get_state(phone)
        if state and state.get("step") == "awaiting_name_location":
            self._set_state(phone, {"step": "awaiting_name_only", "lat": lat, "lng": lng}, ttl=1800)
            return "Como se llama tu negocio?" if lang == "es" else "What's your business name?"

        self._set_state(phone, {"step": "awaiting_name_only", "lat": lat, "lng": lng}, ttl=1800)
        return "Como se llama tu negocio?" if lang == "es" else "What's your business name?"

    async def _onboard_step_after_pin(self, phone: str, text_body: str, lang: str) -> str:
        state = self._get_state(phone) or {}
        lat = state.get("lat")
        lng = state.get("lng")
        name = text_body.strip()
        if not name:
            return "Necesito el nombre del negocio." if lang == "es" else "I need your business name."
        if lat is None or lng is None:
            return await self._onboard_step2(phone, text_body, lang)

        db = SessionLocal()
        try:
            import uuid as _uuid

            vid = f"v_{_uuid.uuid4().hex[:8]}"
            db.execute(
                text("""
                    INSERT INTO vendors (id, name, phone, location)
                    VALUES (:id, :name, :phone,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                    ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """),
                {"id": vid, "name": name, "phone": phone, "lat": float(lat), "lng": float(lng)},
            )
            db.commit()
        finally:
            db.close()

        self._set_state(phone, {"step": "awaiting_menu_photo"}, ttl=1800)
        if lang == "es":
            return "Perfecto! Ahora manda foto de tu menu."
        return "Perfect! Now send a photo of your menu."

    async def _onboard_step2(self, phone: str, text_body: str, lang: str) -> str:
        # Parse name + location from free text using Groq
        name, location_str = await self._extract_name_location(text_body)
        coords = await self._geocode(location_str)
        if coords["lat"] == 0.0 and coords["lng"] == 0.0:
            return "No encontre esa ubicacion. Mandame una calle con cruce o zip code." if lang == "es" else "I could not find that location. Send a cross-street or zip code."

        db = SessionLocal()
        try:
            import uuid as _uuid
            vid = f"v_{_uuid.uuid4().hex[:8]}"
            db.execute(
                text("""
                    INSERT INTO vendors (id, name, phone, location)
                    VALUES (:id, :name, :phone,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                    ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """),
                {"id": vid, "name": name, "phone": phone,
                 "lat": coords["lat"], "lng": coords["lng"]}
            )
            db.commit()
        finally:
            db.close()

        self._set_state(phone, {"step": "awaiting_menu_photo"}, ttl=1800)
        if lang == "es":
            return "Perfecto! Ahora manda foto de tu menu."
        return "Perfect! Now send a photo of your menu."

    # ──────────────────────────────────────────────────────────────
    # Menu handling
    # ──────────────────────────────────────────────────────────────
    async def _handle_media(
        self,
        phone: str,
        vendor_id: str,
        media_url: str | None,
        lang: str,
        image_bytes: bytes | None = None,
    ) -> str:
        # If deal is being created, attach media to pending deal
        pending = self._get_pending_deal(vendor_id)
        if pending:
            pending["media_url"] = media_url or pending.get("media_url")
            self._set_pending_deal(vendor_id, pending)
            return "Foto guardada. Ahora dime los detalles del deal." if lang == "es" else "Photo saved. Now tell me the deal details."

        # Otherwise treat as menu upload
        if image_bytes is None:
            if not media_url:
                return "Manda una foto del menu." if lang == "es" else "Send a menu photo."
            try:
                import httpx

                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.get(
                        media_url,
                        auth=(os.getenv("TWILIO_ACCOUNT_SID", ""), os.getenv("TWILIO_AUTH_TOKEN", "")),
                    )
                    image_bytes = resp.content
            except Exception as e:
                return f"No pude descargar la imagen: {e}" if lang == "es" else f"Could not download image: {e}"

        fallback_url = media_url or "telegram:image"
        stored_url = self._upload_menu_image(vendor_id, image_bytes, fallback_url)
        from app.services.ocr_service import OCRService
        try:
            ocr = OCRService()
        except RuntimeError:
            return "No pude leer la foto. Escribe tus articulos uno por linea: Tacos $25" if lang == "es" else "I could not read the photo. Text items one per line: Tacos $25"
        items = ocr.extract_items(image_bytes)

        if len(items) < 2:
            # Treat as product/deal media, not menu
            self._cache_media(vendor_id, stored_url)
            if lang == "es":
                return "No pude leer bien la foto. Escribe tus articulos asi: Tacos $25"
            return "I could not read the photo. Text items like: Tacos $25"

        # Store OCR results pending confirmation
        self._set_state(phone, {"step": "awaiting_menu_confirm", "items": items, "media_url": stored_url}, ttl=1800)
        lines = "\n".join([f"• {i['name']} — ${i['price']}" if i.get('price') else f"• {i['name']}" for i in items])
        if lang == "es":
            return f"Encontre estos articulos:\n{lines}\nCorrecto? Responde SI o dime que cambiar."
        return f"I found these items in your menu:\n{lines}\n\nIs this correct? Reply YES to save or tell me what to change."

    async def _confirm_menu(self, phone: str, vendor_id: str, lang: str) -> str:
        state = self._get_state(phone) or {}
        items = state.get("items", [])
        db = SessionLocal()
        try:
            import uuid as _uuid
            for item in items:
                mid = f"m_{_uuid.uuid4().hex[:8]}"
                db.execute(
                    text("""
                        INSERT INTO menus (id, vendor_id, item_name, description, price, is_available)
                        VALUES (:id, :vid, :name, :desc, :price, true)
                        ON CONFLICT DO NOTHING
                    """),
                    {"id": mid, "vid": vendor_id, "name": item["name"],
                     "desc": item.get("description", ""), "price": item.get("price") or 0}
                )
            if state.get("media_url"):
                db.execute(
                    text("UPDATE vendors SET menu_image_url = :url, status = 'active' WHERE id = :vid"),
                    {"url": state["media_url"], "vid": vendor_id},
                )
            db.commit()
        finally:
            db.close()

        vendor = self._get_vendor_by_id(vendor_id)
        slug = vendor_id if not vendor else vendor.get("id", vendor_id)
        self._clear_state(phone)

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        if lang == "es":
            return (f"Listo! Tu tienda esta en: {frontend_url}/vendor/{slug}\n"
                    f"Para un deal: FLASH 5pm-7pm tacos 50% 20 porciones\n"
                    f"Ejemplo: FLASH 5pm-7pm tacos 50%")
        return (f"✅ Your store is live! {frontend_url}/vendor/{slug}\n\n"
                f"To launch a deal: FLASH [time] [item] [discount or price]\n"
                f"Example: FLASH 5pm-7pm tacos 50%")

    async def _handle_menu_correction(self, phone: str, vendor_id: str, text_body: str, lang: str) -> str:
        # Simple pass-through: re-parse correction with Groq then re-show
        self._clear_state(phone)
        if lang == "es":
            return "Entendido. Escribe tus artículos uno por línea:\nEjemplo: Tacos $25"
        return "Got it. Write your items one per line:\nExample: Tacos $25"

    # ──────────────────────────────────────────────────────────────
    # Deal creation flow
    # ──────────────────────────────────────────────────────────────
    def _is_deal_intent(self, text: str) -> bool:
        lower = text.lower()
        return any(k in lower for k in DEAL_KEYWORDS)

    async def _parse_deal_start(self, phone: str, vendor_id: str, text_body: str, lang: str) -> str:
        from app.services.deal_parser_service import deal_parser
        vendor = self._get_vendor_by_id(vendor_id)
        tz = (vendor or {}).get("timezone", "UTC")
        parsed = deal_parser.parse(text_body, tz)

        # Merge with any existing pending deal
        pending = self._get_pending_deal(vendor_id) or {}
        pending.update({k: v for k, v in parsed.items() if v is not None})
        self._set_pending_deal(vendor_id, pending)

        missing = deal_parser.first_missing_field(pending)
        if missing:
            self._set_state(phone, {"step": "awaiting_deal_field", "missing": missing})
            return deal_parser.clarification_question(missing, lang)

        return await self._show_deal_confirmation(phone, vendor_id, lang)

    async def _handle_deal_clarification(self, phone: str, vendor_id: str, text_body: str, lang: str) -> str:
        from app.services.deal_parser_service import deal_parser
        state = self._get_state(phone) or {}
        missing = state.get("missing", "")
        pending = self._get_pending_deal(vendor_id) or {}

        # Apply the answer
        lower = text_body.strip().lower()
        if missing == "end_time":
            re_parsed = deal_parser.parse(f"deal until {text_body}", "UTC")
            if re_parsed.get("end_time"):
                pending["end_time"] = re_parsed["end_time"]
        elif missing == "quantity":
            nums = re.findall(r"\d+", text_body)
            if nums:
                pending["quantity"] = int(nums[0])
        elif missing == "price":
            nums = re.findall(r"[\d.]+", text_body)
            if nums:
                if "%" in text_body:
                    pending["discount_pct"] = float(nums[0])
                else:
                    pending["deal_price"] = float(nums[0])
        elif missing == "item_name":
            pending["item_name"] = text_body.strip()

        self._set_pending_deal(vendor_id, pending)
        missing2 = deal_parser.first_missing_field(pending)
        if missing2:
            self._set_state(phone, {"step": "awaiting_deal_field", "missing": missing2})
            return deal_parser.clarification_question(missing2, lang)

        return await self._show_deal_confirmation(phone, vendor_id, lang)

    async def _show_deal_confirmation(self, phone: str, vendor_id: str, lang: str) -> str:
        pending = self._get_pending_deal(vendor_id) or {}
        item = pending.get("item_name", "?")
        deal_price = pending.get("deal_price")
        orig_price = pending.get("original_price")
        discount = pending.get("discount_pct")
        qty = pending.get("quantity", "?")
        end_time = pending.get("end_time", "?")
        radius = pending.get("radius_miles", 10)

        price_str = f"${deal_price}" if deal_price else (f"{int(discount)}% off" if discount else "?")
        orig_str = f" (antes ${orig_price})" if orig_price else ""

        self._set_state(phone, {"step": "awaiting_deal_confirm"})

        if lang == "es":
            return (f"🔥 Deal listo para publicar:\n"
                    f"• {item} — {price_str}{orig_str}\n"
                    f"• {qty} órdenes disponibles\n"
                    f"• Hasta {end_time} · {radius} millas de radio\n\n"
                    f"¿Publicamos? Responde SÍ")
        return (f"🔥 Deal ready to publish:\n"
                f"• {item} — {price_str}{orig_str}\n"
                f"• {qty} orders available\n"
                f"• Until {end_time} · {radius} mile radius\n\n"
                f"Publish? Reply YES")

    async def _publish_deal(self, phone: str, vendor_id: str, lang: str) -> str:
        pending = self._get_pending_deal(vendor_id) or {}
        from app.services.deal_service import DealService
        svc = DealService()

        vendor = self._get_vendor_by_id(vendor_id)
        lat = vendor.get("lat") if vendor else 0
        lng = vendor.get("lng") if vendor else 0

        result = svc.create_flash_deal({
            "vendor_id": vendor_id,
            "item_name": pending.get("item_name"),
            "original_price": pending.get("original_price"),
            "deal_price": pending.get("deal_price"),
            "discount_pct": pending.get("discount_pct"),
            "quantity": pending.get("quantity", 20),
            "start_time": pending.get("start_time"),
            "end_time": pending.get("end_time"),
            "radius_miles": pending.get("radius_miles", 10),
            "media_url": pending.get("media_url"),
            "vendor_name": vendor.get("name") if vendor else "",
            "lat": lat,
            "lng": lng,
        })

        self._clear_state(phone)
        self._clear_pending_deal(vendor_id)

        if lang == "es":
            return "Deal publicado! Clientes cercanos ya fueron notificados."
        return "Deal published! Nearby customers were notified."

    async def _cancel_active_deal(self, vendor_id: str, lang: str) -> str:
        from app.services.deal_service import DealService
        svc = DealService()
        cancelled = svc.cancel_vendor_active_deals(vendor_id)
        if lang == "es":
            return f"Deal cancelado. Se procesaron {cancelled} reembolsos automáticamente."
        return f"Deal cancelled. {cancelled} refunds processed automatically."

    # ──────────────────────────────────────────────────────────────
    # Groq free-form response
    # ──────────────────────────────────────────────────────────────
    async def _groq_response(self, vendor_id: str, text_body: str, lang: str) -> str:
        if not self._groq:
            if lang == "es":
                return "No entendí. Manda: FLASH [hora] [artículo] [descuento]"
            return "Didn't understand. Send: FLASH [time] [item] [discount]"

        system = (
            "Eres el agente de InfraStreet. Ayudas a vendedores callejeros a lanzar deals. "
            "Responde en máximo 200 caracteres. No hagas más de una pregunta a la vez. "
            "Si el vendedor quiere crear un deal, dile que escriba: FLASH [hora] [artículo] [precio o descuento]"
        ) if lang == "es" else (
            "You are the InfraStreet agent. You help street vendors launch deals. "
            "Reply in max 200 characters. Never ask more than one question. "
            "If the vendor wants a deal, tell them: FLASH [time] [item] [price or discount]"
        )

        try:
            resp = self._groq.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": text_body},
                ],
                max_tokens=150,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            print(f"Groq error: {e}")
            return "FLASH [hora] [artículo] [descuento]" if lang == "es" else "FLASH [time] [item] [discount]"

    # ──────────────────────────────────────────────────────────────
    # Helpers — DB
    # ──────────────────────────────────────────────────────────────
    def _get_vendor_by_phone(self, phone: str):
        db = SessionLocal()
        try:
            row = db.execute(
                text("SELECT id, name, phone, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM vendors WHERE phone = :p"),
                {"p": phone}
            ).fetchone()
            return dict(row._mapping) if row else None
        finally:
            db.close()

    def _get_vendor_by_id(self, vendor_id: str):
        db = SessionLocal()
        try:
            row = db.execute(
                text("SELECT id, name, phone, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM vendors WHERE id = :id"),
                {"id": vendor_id}
            ).fetchone()
            return dict(row._mapping) if row else None
        finally:
            db.close()

    # ──────────────────────────────────────────────────────────────
    # Helpers — Redis state
    # ──────────────────────────────────────────────────────────────
    def _get_state(self, phone: str):
        if not self._redis:
            return None
        v = self._redis.get(f"state:{phone}")
        return json.loads(v) if v else None

    def _set_state(self, phone: str, state: dict, ttl: int = 3600):
        if not self._redis:
            return
        self._redis.setex(f"state:{phone}", ttl, json.dumps(state))

    def _clear_state(self, phone: str):
        if not self._redis:
            return
        self._redis.delete(f"state:{phone}")

    def _get_pending_deal(self, vendor_id: str):
        if not self._redis:
            return None
        v = self._redis.get(f"pending_deal:{vendor_id}")
        return json.loads(v) if v else None

    def _set_pending_deal(self, vendor_id: str, deal: dict, ttl: int = 1800):
        if not self._redis:
            return
        self._redis.setex(f"pending_deal:{vendor_id}", ttl, json.dumps(deal))

    def _clear_pending_deal(self, vendor_id: str):
        if not self._redis:
            return
        self._redis.delete(f"pending_deal:{vendor_id}")

    def _cache_media(self, vendor_id: str, url: str, ttl: int = 3600):
        if not self._redis:
            return
        self._redis.setex(f"media:{vendor_id}", ttl, url)

    def _get_lang(self, phone: str):
        if not self._redis:
            return None
        return self._redis.get(f"lang:{phone}")

    def _set_lang(self, phone: str, lang: str):
        if not self._redis:
            return
        self._redis.setex(f"lang:{phone}", 86400, lang)

    # ──────────────────────────────────────────────────────────────
    # Helpers — NLP
    # ──────────────────────────────────────────────────────────────
    def _detect_lang(self, text: str) -> str:
        spanish_markers = ["hola", "quiero", "tengo", "precio", "cómo", "como",
                           "qué", "que", "para", "por", "con", "una", "las", "los"]
        lower = text.lower()
        for m in spanish_markers:
            if m in lower:
                return "es"
        return "en"

    def _upload_menu_image(self, vendor_id: str, image_bytes: bytes, fallback_url: str) -> str:
        try:
            import boto3
            from datetime import datetime, timezone

            key_id = os.getenv("B2_KEY_ID")
            app_key = os.getenv("B2_APP_KEY")
            bucket = os.getenv("B2_BUCKET", "infrastreet-bucket")
            endpoint = os.getenv("B2_ENDPOINT", "https://s3.us-east-005.backblazeb2.com")
            if not endpoint.startswith("http"):
                endpoint = f"https://{endpoint}"
            if not key_id or not app_key:
                return fallback_url
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            key = f"vendors/{vendor_id}/menu_{timestamp}.jpg"
            s3 = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=key_id,
                aws_secret_access_key=app_key,
            )
            s3.put_object(Bucket=bucket, Key=key, Body=image_bytes, ContentType="image/jpeg", ACL="public-read")
            host = endpoint.replace("https://", "")
            return f"https://{bucket}.{host}/{key}"
        except Exception as e:
            print(f"B2 upload error: {e}")
            return fallback_url

    async def _extract_name_location(self, text: str) -> tuple[str, str]:
        if not self._groq:
            parts = text.split(",", 1)
            name = parts[0].strip()
            loc = parts[1].strip() if len(parts) > 1 else text.strip()
            return name, loc
        try:
            resp = self._groq.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{
                    "role": "user",
                    "content": (
                        f'Extract business name and location from: "{text}". '
                        'Return ONLY JSON: {{"name": "...", "location": "..."}}'
                    )
                }],
                max_tokens=100,
                temperature=0.1,
            )
            raw = resp.choices[0].message.content or "{}"
            raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            data = json.loads(raw)
            return data.get("name", text), data.get("location", text)
        except Exception:
            parts = text.split(",", 1)
            return parts[0].strip(), parts[1].strip() if len(parts) > 1 else text.strip()

    async def _geocode(self, location_str: str) -> dict:
        """Geocode a location string to lat/lng via OpenStreetMap Nominatim."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": location_str, "format": "json", "limit": 1},
                    headers={"User-Agent": "InfraStreet/1.0"},
                )
                results = resp.json()
                if results:
                    return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
        except Exception:
            pass
        return {"lat": 0.0, "lng": 0.0}


agent_service = AgentService()
