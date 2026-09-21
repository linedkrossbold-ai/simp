const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { resolveDiscordToken } = require('./utils/discordToken');
const { buildApplicationCommand } = require('./utils/applicationCommands');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const commands = [];
const commandNames = new Set();
const commandsPath = path.join(__dirname, 'commands');

function getCommandFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getCommandFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      results.push(fullPath);
    }
  }

  return results;
}

const commandFiles = getCommandFiles(commandsPath);

for (const filePath of commandFiles) {
  const command = buildApplicationCommand(require(filePath));
  if (command?.data?.toJSON) {
    const payload = command.data.toJSON();
    if (commandNames.has(payload.name)) {
      throw new Error(`Duplicate slash command name: ${payload.name} (${filePath})`);
    }
    commandNames.add(payload.name);
    commands.push(payload);
  }
}

const tokenResolution = resolveDiscordToken(process.env);
if (!tokenResolution.token) {
  console.error(tokenResolution.error);
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(tokenResolution.token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID || ''),
      { body: commands },
    );

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
