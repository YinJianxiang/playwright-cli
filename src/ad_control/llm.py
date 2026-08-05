from __future__ import annotations

import httpx

from .config import Settings

VISION_PROBE_PNG = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAN0lEQVR4nO3RwQ0AMAjDwJT9d05HMB9+vgGCZF7bXJrT9XhgwR8gEyETIRMhEyETIRMhEyEThXzH8QM9OMM6fAAAAABJRU5ErkJggg=="


def create_llm(settings: Settings):
    from browser_use import ChatOpenAI
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.llm_api_key.get_secret_value(),
        base_url=settings.llm_base_url,
        temperature=0,
    )


async def validate_model(settings: Settings, *, verify_vision: bool = True) -> dict:
    headers = {"Authorization": f"Bearer {settings.llm_api_key.get_secret_value()}"}
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.get(f"{settings.llm_base_url}/models", headers=headers)
        response.raise_for_status()
        ids = {item.get("id") for item in response.json().get("data", [])}
        if settings.llm_model not in ids:
            raise RuntimeError(f"Configured model is unavailable: {settings.llm_model}")
        if verify_vision:
            payload = {
                "model": settings.llm_model,
                "max_tokens": 4,
                "temperature": 0,
                "messages": [{"role": "user", "content": [
                    {"type": "text", "text": "Reply OK if you can inspect this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{VISION_PROBE_PNG}"}},
                ]}],
            }
            probe = await client.post(f"{settings.llm_base_url}/chat/completions", headers=headers, json=payload)
            if probe.status_code >= 400:
                raise RuntimeError(f"Model vision probe failed ({probe.status_code}); set LLM_MODEL to a vision-capable model")
    return {"available": True, "vision": verify_vision, "model": settings.llm_model, "base_url": settings.llm_base_url}
