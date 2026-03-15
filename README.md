# MarvelPrimeJS

## Run the bot
1. Copy `.env.example` to `.env` and fill in your values.
1. Install dependencies: `npm install`
1. Start the bot: `npm start`

## Environment variables
- `TOKEN`: Discord bot token.
- `MONGO_URI`: MongoDB connection string (required for database features).
- `PREFIX`: Prefix for commands (default `.`).
- `NO_PREFIX`: `true` to allow commands without a prefix.
- `NO_PREFIX_USERS`: Optional comma-separated user IDs who can use no-prefix commands.
- `REGISTER_SLASH`: `true` to register slash commands on startup.
- `GUILD_ID`: Optional guild ID for fast slash command registration (recommended for testing).
- `OWNER_IDS`: Optional comma-separated owner IDs for owner-only features.

## Command types
- **Prefix**: `.help`
- **Mention prefix**: `@Bot help`
- **No prefix** (if enabled): `help`
- **Slash**: `/help`
