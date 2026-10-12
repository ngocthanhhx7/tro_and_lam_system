# VPS TRO & LAM

- Domain: https://trovalam.vn (www redirects to the main domain).
- Server: `ec2-user@ec2-3-26-8-132.ap-southeast-2.compute.amazonaws.com`, Amazon Linux 2023 ARM64.
- Key stays on the owner's Windows machine; it is never included in an upload or Git.
- Source and built frontend: `/opt/tro-lam/current` (symlink to a versioned release).
- Backend configuration: `/opt/tro-lam/current/backend/.env`, a symlink to `/opt/tro-lam/shared/backend.env`.
- Frontend uses `VITE_API_BASE_URL=/api/v1` and Nginx on the same HTTPS domain. No frontend secrets are required.
- API service: `tro-lam-api`, runs as `trolam` and listens on `127.0.0.1:5000`.
- Atlas only: no local MongoDB is installed and no demo data is seeded.

## Complete the Atlas configuration

1. Add `3.26.8.132/32` to Atlas Network Access. Use a database user with the required rights for the intended application database; include that database name in the URI and URL-encode special characters in its password.
2. On the VPS, run `sudo nano /opt/tro-lam/current/backend/.env` and fill `MONGODB_URI`. CSRF and outbox keys are generated once during first installation. Keep them unchanged across releases. Optional SMTP fields must be completed together if email is needed.
3. Run `sudo /opt/tro-lam/current/ops/vps/activate-backend.sh`. This validates configuration, creates declared schema indexes without dropping anything, then starts the API. Duplicate data or missing Atlas permissions stop activation; review the existing database rather than deleting data to bypass the failure.
4. Verify `curl -fsS https://trovalam.vn/api/v1/health/ready` and `sudo systemctl status tro-lam-api --no-pager`.

Until step 3, the frontend is available and API requests honestly return HTTP 503. No placeholder database is connected. An enabled API service with incomplete configuration stays inactive through its startup condition, rather than repeatedly restarting.

## Operations

```bash
sudo systemctl restart tro-lam-api
sudo journalctl -u tro-lam-api -n 30 --no-pager
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status certbot-renew.timer --no-pager
```

Certbot uses `/var/lib/tro-lam/acme` for HTTP validation and reloads Nginx after certificate renewal. Ports 80 and 443 must remain reachable. API port 5000 is loopback only.

The current application disables production image/support attachment uploads until a durable provider is implemented. SMTP, PayOS and Gemini remain unavailable until the owner's configuration enables them. Existing Atlas records must be verified as appropriate for public use; installation does not publish demo fixtures.

Reference SKUs remain blocked from purchase by default. After the owner explicitly approves exact products, `approve-purchases.js` accepts their distinct product IDs and records the approval in `products.purchaseApproved`. It requires existing published direct-sale products with a positive price and available stock. The operator migration saves a private backup and uses product versions plus audit records in a transaction; it does not rename SKUs or change price/inventory. Future reference products remain blocked until separately approved.

For subsequent deployments, upload a new release directory and install dependencies there; retain the shared env. Record the previous `current` target before switching. To roll back application files, point `current` to that previous release and restart the API/reload Nginx. Retain database indexes and durable configuration; do not roll back by deleting orders, users or payment history.

Shipping fees are editable under Admin → Cài đặt → Phí giao hàng. A Vietnam-wide fallback uses `provinceNames: ["*"]`; a configured exact province match overrides it. COD enablement and maximum pending COD orders per customer are editable on the same screen, with version checks and audit. Prices and payment totals remain calculated by the backend.

For free location suggestions, set `GEOCODING_PROVIDER=photon` in the shared backend env and restart the API. No API key is required. The public [Photon service](https://photon.komoot.io/) permits fair use but may throttle and provides no uptime guarantee. The application rounds coordinates, bounds request frequency and caches suggestions in memory. The customer clicks the location button, allows browser location and reviews the suggestion; manual addresses remain usable. Test with a public landmark rather than obtaining anyone's live location as an operator.
