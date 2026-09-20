"""
Supabase Storage backend for product images.

Uploads are persisted to a public Supabase Storage bucket so the Django API
returns URLs that render from the Supabase CDN (Render's filesystem is
ephemeral and never serves ``/media/`` in production).

Behavior mirrors the previous local filesystem setup: every upload goes
through ``default_storage`` and stored URLs are produced with
``default_storage.url(name)`` — only the backend differs.

The backend is only active when ``SUPABASE_URL`` and
``SUPABASE_SERVICE_ROLE_KEY`` are configured; otherwise the app falls back to
``FileSystemStorage`` for local development.
"""

import posixpath
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


def storage_base_url():
    return f"{getattr(settings, 'SUPABASE_URL', '').rstrip('/')}/storage/v1"


def storage_bucket():
    return getattr(settings, 'SUPABASE_STORAGE_BUCKET', 'product-images')


def supabase_storage_enabled():
    return bool(
        getattr(settings, 'SUPABASE_URL', '')
        and getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '')
    )


def object_key_from_url(image_url):
    """Return the storage object key for a stored image URL, or ``None``.

    Accepts Supabase public/render URLs (``https://<ref>.supabase.co/
    storage/v1/object/{public|render/image}/public/<bucket>/<key>``) and local
    media URLs (``/media/<key>``). External URLs (Unsplash, etc.) yield None.
    """
    value = str(image_url or '').strip()
    if not value:
        return None

    path = urlsplit(value).path or value
    bucket = storage_bucket()

    render_marker = f'/storage/v1/object/render/image/public/{bucket}/'
    public_marker = f'/storage/v1/object/public/{bucket}/'
    for marker in (render_marker, public_marker):
        if marker in path:
            key = path.split(marker, 1)[1].lstrip('/')
            return key or None

    media_url = getattr(settings, 'MEDIA_URL', '/media/').rstrip('/')
    if media_url and path.startswith(media_url):
        key = path[len(media_url):].lstrip('/')
        return key or None

    return None


def supabase_transform_url(image_url, width=None, height=None, resize='cover',
                           format='webp', quality=None):
    """Rebase a stored Supabase URL onto the image render endpoint.

    Returns ``image_url`` unchanged for non-Supabase (e.g. Unsplash or local
    media) URLs so callers can apply this unconditionally per image.
    """
    key = object_key_from_url(image_url)
    if not key or '/storage/v1/' not in urlsplit(image_url).path:
        return image_url

    base = (
        f"{storage_base_url()}/object/render/image/public/"
        f"{storage_bucket()}/{posixpath.join(*key.split('/'))}"
    )
    params = {}
    if width:
        params['width'] = int(width)
    if height:
        params['height'] = int(height)
    if resize:
        params['resize'] = resize
    if format:
        params['format'] = format
    if quality:
        params['quality'] = int(quality)
    if not params:
        return image_url
    return f"{base}?{urlencode(params)}"


@deconstructible
class SupabaseStorage(Storage):
    """Django storage adapter writing files into a public Supabase bucket."""

    def __init__(self, url=None, key=None, bucket=None):
        self.url = (url or getattr(settings, 'SUPABASE_URL', '') or '').rstrip('/')
        self.key = key or getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or ''
        self.bucket = bucket or getattr(settings, 'SUPABASE_STORAGE_BUCKET', 'product-images')
        self._client = None

    # -- internals ---------------------------------------------------------

    def _get_bucket_proxy(self):
        if self._client is None:
            from supabase import create_client
            self._client = create_client(self.url, self.key)
        return self._client.storage.from_(self.bucket)

    # -- Storage API -------------------------------------------------------

    def _save(self, name, content):
        if hasattr(content, 'seek'):
            content.seek(0)
        data = content.read()

        content_type = getattr(content, 'content_type', None)
        if not content_type:
            content_type = 'image/png' if str(name).lower().endswith(
                '.png') else 'application/octet-stream'

        file_options = {
            'content-type': content_type,
            'cache-control': 'public, max-age=31536000, immutable',
            'upsert': True,
        }
        self._get_bucket_proxy().upload(name, data, file_options)
        return name

    def _open(self, name, mode='rb'):
        data = self._get_bucket_proxy().download(name)
        return ContentFile(data, name)

    def delete(self, name):
        try:
            self._get_bucket_proxy().remove([name])
        except Exception:
            # Supabase treats deleting a missing object as a soft no-op that
            # still returns 200; swallow client/network errors here so a failed
            # cleanup never breaks the surrounding transaction.
            pass

    def exists(self, name):
        try:
            self._get_bucket_proxy().info(name)
            return True
        except Exception:
            return False

    def url(self, name):
        return (
            f"{storage_base_url()}/object/public/{self.bucket}/"
            f"{posixpath.normpath(name)}"
        )

    def render_url(self, name, width=None, height=None, resize='cover',
                   format='webp', quality=None, **options):
        params = {}
        if width:
            params['width'] = int(width)
        if height:
            params['height'] = int(height)
        if resize:
            params['resize'] = resize
        if format:
            params['format'] = format
        if quality:
            params['quality'] = int(quality)
        base = (
            f"{storage_base_url()}/object/render/image/public/{self.bucket}/"
            f"{posixpath.normpath(name)}"
        )
        if not params:
            return base
        return f"{base}?{urlencode(params)}"

    def get_valid_name(self, name):
        return name

    def get_available_name(self, name, max_length=None):
        return name