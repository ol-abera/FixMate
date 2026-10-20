import os

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_image_file(f):
    """Validate extension, size, and that the bytes are really an image."""
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Unsupported file type. Allowed: JPG, PNG, WEBP.")
    if f.size > settings.MAX_IMAGE_UPLOAD_BYTES:
        mb = settings.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)
        raise ValidationError(f"File too large. Maximum size is {mb} MB.")
    try:
        f.seek(0)
        img = Image.open(f)
        fmt = img.format
        img.verify()
    except Exception:
        raise ValidationError("Uploaded file is not a valid image.")
    finally:
        f.seek(0)
    if fmt not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("Unsupported image format. Allowed: JPEG, PNG, WEBP.")
