# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Upload File** sends files over 5 MB through a signed upload link instead of one JSON request, which the API rejected above about 7.5 MB.
- **Image → Get** outputs the image fields at the top level, like every other Get operation.
- **Thumbnail → Get Many** pages through results instead of stopping at 12.
- **Thumbnail → Create** accepts reference images on their own.
- **Music → Create** asks for lyrics before calling the API when the model makes songs. "Mureka 7.5 (Instrumental)" is labelled as the model for background music without lyrics.
- **Post → Create** with Publish Now: a retried item whose post is already publishing or published no longer fails, and a failed publish names the draft post's ID. Status and type use the same upper-case values as Get.
- **Unsora Trigger**: polls the most recently changed records (`sort=updated`), compares a bounded window, and never fires for events from before activation, so a long clipping history can't flood the workflow. **Post Failed** fires again when a retried post fails again.
- Waiting for a job stops within about a second when the execution is cancelled.

## [0.1.0] - 2026-10-29

### Added

- **Unsora** node with these resources: Account, AI Influencer, Clipping, Image, Music, Post, Thumbnail, Upload, User, Video and Voiceover. Together they cover every operation in the Unsora public API.
- **Wait for Completion** on every async create operation (clipping, video, image, music, voiceover, thumbnail, AI influencer), with a configurable poll interval and timeout.
- Dropdowns loaded from your account for social accounts, voices, video and image models, and Pinterest boards.
- **Post → Create** with per-account caption and title overrides, platform options (TikTok, YouTube, Instagram, Pinterest, Google Business Profile), and Schedule, Publish Now and Draft modes.
- **Upload File** operation that uploads an n8n binary property.
- Optional Idempotency Key on create operations.
- `clipUrl` field on every clip in clipping results.
- **Unsora Trigger**, a polling trigger with three events: Clipping Completed, Post Published and Post Failed.
- **Unsora API** credential (API key and optional base URL). It can also be used from the HTTP Request node.
- The node can be used as an AI Agent tool.
