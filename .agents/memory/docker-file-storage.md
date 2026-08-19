---
name: Docker file storage
description: Persistent attachment storage requires a writable Docker bind mount at the configured in-container path.
---

The configured `SHARE_PATH` must refer to a directory inside the API container that is backed by a persistent, writable bind mount on the VM.

**Why:** a configured path alone does not create a Docker volume. An absent mount produces an `ENOENT` write failure and attachments cannot be saved.

**How to apply:** mount a persistent VM directory at the exact container path configured as `SHARE_PATH`, then verify write access from inside the API container before accepting uploads.
