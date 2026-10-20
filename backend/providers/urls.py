from rest_framework.routers import SimpleRouter

from .views import ProviderViewSet

router = SimpleRouter()
router.register("", ProviderViewSet, basename="provider")
urlpatterns = router.urls
