from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """Consistent error shape: {"detail": str, "errors": {...optional field errors}}"""
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError):
        data = response.data
        if isinstance(data, list):
            data = {"non_field_errors": data}
        response.data = {"detail": "Validation failed.", "errors": data}
    elif isinstance(response.data, dict) and "detail" in response.data:
        response.data = {"detail": str(response.data["detail"])}
    return response
