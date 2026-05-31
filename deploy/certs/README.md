# TLS certificates

Put production TLS files here on the server before starting nginx:

- `fullchain.pem`: leaf certificate first, then intermediate CA certificates.
- `privkey.pem`: private key matching the leaf certificate.

These files are mounted read-only into the nginx container at `/etc/nginx/certs`.
They are intentionally ignored by git. Never commit private keys.
