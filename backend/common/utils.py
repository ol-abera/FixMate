def abs_url(request, file_field):
    """Absolute URL for an ImageField/FileField value, or None."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request else url
