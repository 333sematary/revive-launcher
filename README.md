<div align="center">

<img src="docs/media/revive-showcase.gif" alt="Project Revive animated banner" width="100%" />

# Project Revive · Launcher

**A polished desktop home for the Revive experience.**

[![Tauri](https://img.shields.io/badge/Tauri-1-24292f?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-20232a?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

</div>

## Overview

Project Revive Launcher is a Windows desktop app built with Tauri, React, TypeScript, and Vite. It brings account access, game build management, and launcher settings together in one place.

## Features

- Sign in and create an account through the configured backend.
- Manage local game builds from the library.
- View the item shop and player leaderboard.
- Configure available game options and launcher settings.
- Check backend availability from the sidebar.

## Get started

### Requirements

- Windows 10 or newer
- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install) and the Windows build tools required by Tauri

### Run in development

```powershell
git clone https://github.com/333sematary/revive-launcher.git
cd revive-launcher
Copy-Item .env.example .env
bun install
bun tauri dev
```

Edit `.env` with your backend address and the links you want the launcher to use. Keep local credentials and private values out of Git.

### Build the app

```powershell
bun tauri build
```

The installer and application bundles are written under `src-tauri/target/release/bundle/`.

## Configuration

`.env.example` documents the launcher variables. The most commonly changed values are:

| Variable | Purpose |
| --- | --- |
| `VITE_LAUNCHER_NAME` | Name shown in the app |
| `VITE_BACKEND_URL` | Backend API base address |
| `VITE_DISCORD_LINK` | Community invite link |
| `VITE_LOGO_URL` | Logo path or image URL |
| `VITE_BACKGROUND_URL` | Launcher background image |

## Project layout

```text
src/                 React interface and launcher logic
src/assets/          Fonts, styles, and media
public/              Static assets, including the logo
src-tauri/           Tauri application and Windows packaging
docs/media/          Repository presentation assets
```

## Notes

- `bun tauri dev` starts the development build.
- `bun tauri build` creates a production bundle.
- `.env`, build outputs, Rust targets, and local user data are ignored by Git.

## Credits

This launcher is based on the work credited in the original project notes: [Pablo's launcher project](https://github.com/kovryn/Pablos-launcher-leak-an-expose). Project Revive is an independent community project and is not affiliated with Epic Games.
