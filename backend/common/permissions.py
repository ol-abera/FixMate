from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsCustomer(BasePermission):
    message = "Only customers can perform this action."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "CUSTOMER")


class IsProvider(BasePermission):
    message = "Only providers can perform this action."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "PROVIDER")


class IsAdminRole(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "ADMIN")


class IsAuthenticatedOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or bool(request.user and request.user.is_authenticated)
