"""Cloudflare R2 (S3-compatible) photo storage."""

import io
import os
import uuid
from typing import Optional

from PIL import Image, ImageOps

# Configuration via env (set on Fly via `fly secrets set`)
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "aponroots-photos")
R2_PUBLIC_BASE_URL = os.environ.get(
    "R2_PUBLIC_BASE_URL", "https://photos.aponroots.com"
).rstrip("/")

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB hard cap on uploads
RESIZED_MAX_DIMENSION = 1024        # downsize huge photos to this max edge


def storage_configured() -> bool:
    return bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY)


def _client():
    """Lazy import boto3 so pytest tests don't pay the cost."""
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _normalize_image(raw: bytes) -> tuple[bytes, str]:
    """Strip EXIF, auto-rotate, downsize, re-encode to JPEG.
    Returns (bytes, content_type)."""
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)  # honor EXIF rotation, drop the metadata
    if img.mode in ("RGBA", "P", "LA"):
        # Flatten transparency onto white so JPEG works
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize if either dimension exceeds the cap
    w, h = img.size
    longest = max(w, h)
    if longest > RESIZED_MAX_DIMENSION:
        scale = RESIZED_MAX_DIMENSION / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue(), "image/jpeg"


def upload_person_photo(person_id: int, raw: bytes) -> str:
    """Uploads a normalized photo for a given person and returns its public URL."""
    if not storage_configured():
        raise RuntimeError(
            "Photo storage is not configured on the server (missing R2 env vars)."
        )
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("Image too large (max 10 MB)")

    body, ctype = _normalize_image(raw)
    # Keep a per-person prefix so deletions can wipe an old photo cheaply later.
    key = f"persons/{person_id}/{uuid.uuid4().hex}.jpg"

    _client().put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=body,
        ContentType=ctype,
        # Long cache because filenames are immutable (uuid).
        CacheControl="public, max-age=31536000, immutable",
    )

    return f"{R2_PUBLIC_BASE_URL}/{key}"


def delete_photo_url(url: Optional[str]) -> None:
    """Best-effort delete of an old photo when a person is removed/replaced."""
    if not url or not storage_configured():
        return
    if not url.startswith(R2_PUBLIC_BASE_URL + "/"):
        return
    key = url[len(R2_PUBLIC_BASE_URL) + 1 :]
    try:
        _client().delete_object(Bucket=R2_BUCKET, Key=key)
    except Exception:
        # Don't fail the API call if the cleanup misfires.
        pass
