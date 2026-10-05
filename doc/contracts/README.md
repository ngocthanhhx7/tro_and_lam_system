# API contract bundle

`openapi.yaml` is the OpenAPI 3.1 route/operation index. It references request DTOs in `schemas/dtos.schema.json` and closed vocabulary in `schemas/enums.schema.json`. Business names, fields, status values, permissions and workflow constraints stay aligned with `doc/planning/04-data-model.md` and `doc/planning/05-api-contracts.md`.

Validate the whole bundle, referenced schemas, unique operation IDs, declared actor sets, planning enums and representative positive/negative DTO fixtures with:

```sh
npm ci
npm run validate:contracts
```

Health responses preserve the scaffold shape and provider webhook wire/ACK formats remain provider-specific. Do not turn either into the standard application envelope. Contract changes go through the coordinator, with a decision entry and affected consumers noted before feature branches update.

The exact contract baseline commit is recorded in `manifest.json`; package branches start from that commit on `develop`.
