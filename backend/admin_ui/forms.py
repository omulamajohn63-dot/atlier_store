from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, UsernameField
from django.contrib.auth.models import Group
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError

from catalog.models import Category, Product, ProductVariant


class AdminLoginForm(AuthenticationForm):
    """Django built-in authentication form restricted to staff accounts."""

    username = UsernameField(
        label='Username or staff email',
        widget=forms.TextInput(attrs={'autofocus': True}),
    )

    error_messages = {
        **AuthenticationForm.error_messages,
        'no_admin_access': 'This account does not have admin access.',
    }

    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not user.is_staff:
            raise ValidationError(
                self.error_messages['no_admin_access'],
                code='no_admin_access',
            )


class AdminSignupForm(forms.ModelForm):
    """Create a staff administrator account with full powers (superuser-only view)."""

    password = forms.CharField(
        label='Password',
        widget=forms.PasswordInput(render_value=False),
        strip=False,
        help_text='Must not be too similar to the username and must be at least 8 characters.',
    )
    password_confirm = forms.CharField(
        label='Confirm password',
        widget=forms.PasswordInput(render_value=False),
        strip=False,
    )

    class Meta:
        model = get_user_model()
        fields = (
            'username',
            'email',
            'first_name',
            'last_name',
            'groups',
            'is_superuser',
            'is_active',
        )
        labels = {
            'username': 'Username',
            'email': 'Email address',
            'first_name': 'First name',
            'last_name': 'Last name',
            'groups': 'Groups / roles',
            'is_superuser': 'Superuser (full control)',
            'is_active': 'Account active',
        }
        widgets = {
            'groups': forms.SelectMultiple(attrs={'size': 6}),
        }

    def __init__(self, *args, allow_superuser=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.allow_superuser = allow_superuser
        self.fields['groups'].queryset = Group.objects.order_by('name')
        self.fields['groups'].help_text = 'Select the permission groups this administrator belongs to.'
        self.fields['is_superuser'].help_text = 'Superusers bypass all permission checks in the Django admin site.'
        self.fields['is_active'].help_text = 'Unchecking this locks the account immediately.'
        if not allow_superuser:
            self.fields['is_superuser'].disabled = True
            self.initial['is_superuser'] = False
            self.fields['is_superuser'].help_text = (
                'Only a superuser can grant full control.')

    def clean_is_superuser(self):
        is_superuser = self.cleaned_data.get('is_superuser') or False
        if getattr(self, 'allow_superuser', False):
            return is_superuser
        return False

    def clean_password(self):
        password = self.cleaned_data.get('password')
        username = self.cleaned_data.get('username')
        if password:
            password_validation.validate_password(password, user=None)
        if password and username and password.lower() == username.lower():
            raise ValidationError('The password must not match the username.')
        return password

    def clean_password_confirm(self):
        password = self.cleaned_data.get('password')
        password_confirm = self.cleaned_data.get('password_confirm')
        if password and password_confirm and password != password_confirm:
            raise ValidationError('The two password fields did not match.')
        return password_confirm

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_staff = True
        if not getattr(self, 'allow_superuser', False):
            user.is_superuser = False
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
            self.save_m2m()
        return user


class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = ('name', 'slug', 'description', 'image_url', 'is_active')
        labels = {
            'name': 'Category name',
            'slug': 'Web address name',
            'image_url': 'Category image URL',
            'is_active': 'Visible in storefront',
        }
        help_texts = {
            'slug': 'Lowercase words separated by hyphens, for example evening-wear.',
            'image_url': 'Optional URL for the category image.',
        }


class ProductCreateForm(forms.Form):
    name = forms.CharField(label='Product name', max_length=200,
                           help_text='Use the name customers should see.')
    category = forms.ModelChoiceField(
        label='Collection', queryset=Category.objects.filter(is_active=True))
    price = forms.DecimalField(label='Selling price (KES)', max_digits=12,
                               decimal_places=2, min_value=0)
    status = forms.ChoiceField(
        label='Visibility', choices=Product.Status.choices, initial=Product.Status.ACTIVE,
        help_text='Active products appear in the storefront.')
    sku = forms.CharField(label='Internal item code', max_length=80, required=False,
                          help_text='Leave blank to generate a unique code automatically.')
    size = forms.CharField(label='Size', max_length=40, required=False)
    color = forms.CharField(label='Colour', max_length=80, required=False)
    stock_quantity = forms.IntegerField(label='Starting quantity', min_value=0,
                                        initial=0, help_text='How many are ready to sell?')
    image_file = forms.ImageField(
        label='Upload product image', required=True, help_text='Upload the product photo from your device.')

    def clean(self):
        cleaned = super().clean()
        if cleaned.get('sku') and ProductVariant.objects.filter(sku=cleaned['sku']).exists():
            self.add_error('sku', 'A variant with this SKU already exists.')
        return cleaned


class ProductUpdateForm(forms.Form):
    product_id = forms.UUIDField(widget=forms.HiddenInput())
    name = forms.CharField(label='Product name', max_length=200)
    slug = forms.SlugField(label='Web address name', max_length=100)
    category = forms.ModelChoiceField(
        label='Collection', queryset=Category.objects.filter(is_active=True))
    description = forms.CharField(label='Short description', widget=forms.Textarea(
        attrs={'rows': 3}))
    price = forms.DecimalField(label='Selling price (KES)', max_digits=12,
                               decimal_places=2, min_value=0)
    status = forms.ChoiceField(
        label='Visibility', choices=Product.Status.choices)
    image_file = forms.ImageField(
        label='Replace image', required=False, help_text='Upload a new product photo from your device.')

    def __init__(self, *args, **kwargs):
        self.product = kwargs.pop('product', None)
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned = super().clean()
        slug = cleaned.get('slug')
        if slug and self.product and self.product.slug != slug:
            if Product.objects.filter(slug=slug).exclude(pk=self.product.pk).exists():
                self.add_error(
                    'slug', 'A product with this slug already exists.')
        return cleaned


class ProductVariantForm(forms.Form):
    sku = forms.CharField(label='SKU', max_length=80)
    size = forms.CharField(label='Size', max_length=40, required=False)
    color = forms.CharField(label='Colour', max_length=80, required=False)
    color_hex = forms.CharField(
        label='Colour hex', max_length=7, required=False)
    price = forms.DecimalField(
        label='Variant price (KES)', max_digits=12, decimal_places=2,
        min_value=0, required=False,
        help_text='Leave blank to use the product price.')
    stock_quantity = forms.IntegerField(
        label='Stock quantity', min_value=0, initial=0)
    is_active = forms.BooleanField(
        label='Available for sale', required=False, initial=True)

    def __init__(self, *args, **kwargs):
        self.product = kwargs.pop('product')
        self.variant = kwargs.pop('variant', None)
        super().__init__(*args, **kwargs)

    def clean_sku(self):
        sku = self.cleaned_data['sku'].strip()
        queryset = ProductVariant.objects.filter(sku=sku)
        if self.variant:
            queryset = queryset.exclude(pk=self.variant.pk)
        if queryset.exists():
            raise forms.ValidationError(
                'A variant with this SKU already exists.')
        return sku

    def clean_color_hex(self):
        value = self.cleaned_data.get('color_hex', '').strip()
        if value and (len(value) != 7 or not value.startswith('#')):
            raise forms.ValidationError('Use a hex colour such as #2E5A44.')
        return value.upper()

    def clean(self):
        cleaned = super().clean()
        queryset = ProductVariant.objects.filter(
            product=self.product,
            size=cleaned.get('size', ''),
            color=cleaned.get('color', ''),
        )
        if self.variant:
            queryset = queryset.exclude(pk=self.variant.pk)
        if queryset.exists():
            raise forms.ValidationError(
                'This size and colour combination already exists for the product.')
        return cleaned


class StockAdjustmentForm(forms.Form):
    variant = forms.ModelChoiceField(label='Item to update', queryset=ProductVariant.objects.select_related(
        'product').order_by('product__name', 'sku'))
    delta = forms.IntegerField(label='Quantity change', min_value=-100000,
                               max_value=100000, help_text='Add stock with a positive number or remove it with a negative number.')
    reason = forms.CharField(label='Reason', max_length=40,
                             initial='manual_adjustment')
