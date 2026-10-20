from django.conf import settings
from django.db import models


class Favorite(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    provider = models.ForeignKey("providers.ProviderProfile", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["customer", "provider"], name="unique_favorite")]

    def __str__(self):
        return f"{self.customer_id} ♥ {self.provider_id}"
