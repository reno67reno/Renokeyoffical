const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || "!";
const VIP_ROLE_ID = "1442230685271064726";

// Load keys
let keys = {};
if (fs.existsSync("keys.json")) {
    keys = JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

// Convert time formats like 24h, 3d, 30m
function convertToMs(timeStr) {
    const num = parseInt(timeStr);
    if (timeStr.endsWith("s")) return num * 1000;
    if (timeStr.endsWith("m")) return num * 60 * 1000;
    if (timeStr.endsWith("h")) return num * 60 * 60 * 1000;
    if (timeStr.endsWith("d")) return num * 24 * 60 * 60 * 1000;
    return null;
}

// Save database
function saveKeys() {
    fs.writeFileSync("keys.json", JSON.stringify(keys, null, 2));
}

// Check for expired keys every 10 seconds
setInterval(async () => {
    const now = Date.now();

    for (const key in keys) {
        const data = keys[key];

        // Skip if not activated yet
        if (!data.expiresAt || !data.user) continue;

        if (now >= data.expiresAt) {
            try {
                const guild = client.guilds.cache.get(data.guild);
                if (guild) {
                    const member = await guild.members.fetch(data.user);
                    if (member) {
                        await member.roles.remove(VIP_ROLE_ID);
                    }
                }
            } catch {}

            delete keys[key];
            saveKeys();
            console.log(`Expired + removed role + deleted key: ${key}`);
        }
    }
}, 10000);

// Commands
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Create a timed key
    if (command === "createkey") {
        if (!args[0] || !args[1])
            return message.reply("Format: `!createkey KEY 24h`");

        const key = args[0];
        const durationMs = convertToMs(args[1]);

        if (!durationMs) return message.reply("Invalid time! Use s/m/h/d");

        keys[key] = {
            user: null,
            createdAt: Date.now(),
            duration: durationMs,
            expiresAt: null,
            guild: message.guild.id
        };

        saveKeys();
        message.reply(`Key \`${key}\` created for **${args[1]}**`);
    }

    // User activates key
    if (command === "usekey") {
        if (!args[0]) return message.reply("Provide a key!");

        const key = args[0];
        const data = keys[key];

        if (!data)
            return message.reply("Invalid or expired key!");

        if (data.user)
            return message.reply("This key is already used!");

        // Apply VIP role
        try {
            await message.member.roles.add(VIP_ROLE_ID);
        } catch (e) {
            return message.reply("Bot cannot add the VIP role. Check permissions.");
        }

        data.user = message.author.id;
        data.expiresAt = Date.now() + data.duration;

        saveKeys();

        const timeLeft = new Date(data.expiresAt).toLocaleString();
        message.reply(`Key activated! VIP role granted.\nExpires: **${timeLeft}**`);
    }

    // Check key status
    if (command === "checkkey") {
        if (!args[0]) return message.reply("Provide a key!");

        const key = args[0];
        const data = keys[key];

        if (!data) return message.reply("Invalid or expired key!");

        if (!data.user) return message.reply("Key is unused.");

        message.reply(
            `Key used by <@${data.user}>\nExpires: **${new Date(data.expiresAt).toLocaleString()}**`
        );
    }
});

// Start bot
client.login(TOKEN);

// Express server for Render (fixes “no open ports detected”)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Reno Key System Bot is running!"));
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
