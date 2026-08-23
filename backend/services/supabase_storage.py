import logging

from supabase import create_client
from storage3.exceptions import StorageApiError

logger = logging.getLogger(__name__)

_client = None
_client_key = None


def _get_client(url, key):
    global _client, _client_key
    if _client is None or _client_key != (url, key):
        _client = create_client(url, key)
        _client_key = (url, key)
    return _client


def ensure_bucket_exists(url, key, bucket_name):
    """Idempotently make sure the storage bucket exists. Created private —
    documents are only ever read server-side with the service role key,
    never served directly to the frontend.
    """
    client = _get_client(url, key)
    try:
        client.storage.get_bucket(bucket_name)
    except StorageApiError:
        try:
            client.storage.create_bucket(bucket_name, options={"public": "false"})
            logger.info("Created Supabase Storage bucket %r", bucket_name)
        except StorageApiError:
            logger.exception("Could not create Supabase Storage bucket %r", bucket_name)


def upload_file(url, key, bucket_name, storage_path, content_bytes):
    """Upload a PDF's bytes to Supabase Storage at `storage_path`."""
    client = _get_client(url, key)
    client.storage.from_(bucket_name).upload(
        storage_path,
        content_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )


def download_file(url, key, bucket_name, storage_path):
    """Download a stored PDF's bytes from Supabase Storage."""
    client = _get_client(url, key)
    return client.storage.from_(bucket_name).download(storage_path)


def delete_file(url, key, bucket_name, storage_path):
    """Remove a stored PDF from Supabase Storage."""
    client = _get_client(url, key)
    client.storage.from_(bucket_name).remove([storage_path])
