# Clapshot client
## Frontend components for Clapshot video review tool

This is the web frontend component for Clapshot - a self-hosted collaborative
video review tool. See github page for an overview of the whole tool.

It's a Svelte app that is built into a static site, and served by
Nginx or some other web server. When loaded, it first fetches
`clapshot_client.conf.json`, reads the server URL from it, and then
attempts to connect to the server via websocket.

If you have installed it in a Debian system, the config file is
symlinked to `/etc/clapshot_client.conf`. Otherwise it's located
in the same directory as the `index.html` file.

## Object storage uploads and playback

`clapshot_client.conf.json` can now describe an S3-compatible backend:

```json
"object_storage": {
  "enabled": true,
  "public_base_url": "https://your-bucket.example.com",
  "upload_presign_url": "https://clapshot.example.com/api/storage/upload-url",
  "finalize_upload_url": "https://clapshot.example.com/api/storage/finalize-upload"
}
```

When enabled, uploads use the presigned URL endpoint, and media/subtitle/thumbnail
URLs are rewritten to the `public_base_url` so playback happens directly from
the object storage.

## Localization

The UI now supports multiple locales (English and Simplified Chinese included).
Set `default_locale`/`supported_locales` in `clapshot_client.conf.json` and switch
languages from the user menu in the header.
