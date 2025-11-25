const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

// CONFIG
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || "!";
const VIP_ROLE_ID = "1442230685271064726";

// Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- DATABASE SYSTEM ---
function loadKeys() {
    try {
        if (!fs.existsSync("keys.json")) return {};
        const data = fs.readFileSync("keys.json", "utf8");
        return JSON.parse(data);
    } catch {
        console.log("keys.json corrupted! Restoring backup...");
        if (fs.existsSync("keys-backup.json")) {
            return JSON.parse(fs.readFileSync("keys-backup.json"));
        }
        return {};
    }
}

function saveKeys() {
    fs.writeFileSync("keys.json", JSON.stringify(keys, null, 2));
    fs.writeFileSync("keys-backup.json", JSON.stringify(keys, null, 2));
}

let keys = loadKeys();

// --- TIME CONVERSION ---
function convertToMs(timeStr) {
    const num = parseInt(timeStr);
    if (timeStr.endsWith("s")) return num * 1000;
    if (timeStr.endsWith("m")) return num * 60 * 1000;
    if (timeStr.endsWith("h")) return num * 60 * 60 * 1000;
    if (timeStr.endsWith("d")) return num * 24 * 60 * 60 * 1000;
    return null;
}

// --- AUTO EXPIRATION SYSTEM ---
setInterval(async () => {
    const now = Date.now();

    for (const key in keys) {
        const data = keys[key];

        if (!data.expiresAt || !data.user) continue;

        if (now >= data.expiresAt) {
            try {
                const guild = client.guilds.cache.get(data.guild);
                if (guild) {
                    const member = await guild.members.fetch(data.user);
                    if (member) await member.roles.remove(VIP_ROLE_ID);
                }
            } catch {}

            console.log(`EXPIRED: ${key} (user lost VIP)`);

            delete keys[key];
            saveKeys();
        }
    }
}, 10000);

// --- COMMAND HANDLING ---
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const isAdmin = message.member.permissions.has("Administrator");

    // ------- ADMIN COMMANDS ---------

    // Create single key
    if (command === "createkey") {
        if (!isAdmin) return message.reply("Admins only.");
        if (!args[0] || !args[1]) return message.reply("Format: `!createkey KEY 24h`");

        const key = args[0];
        const durationMs = convertToMs(args[1]);
        if (!durationMs) return message.reply("Invalid time. Use s/m/h/d");

        keys[key] = {
            user: null,
            createdAt: Date.now(),
            duration: durationMs,
            expiresAt: null,
            guild: message.guild.id
        };

        saveKeys();
        message.reply(`Created key **${key}** for **${args[1]}**`);
    }

    // Generate multiple keys
    if (command === "genmulti") {
        if (!isAdmin) return message.reply("Admins only.");
        if (!args[0] || !args[1])
            return message.reply("Format: `!genmulti <amount> <duration>`");

        const amount = parseInt(args[0]);
        const durationMs = convertToMs(args[1]);

        if (!amount || amount < 1) return message.reply("Invalid amount.");
        if (!durationMs) return message.reply("Invalid time.");

        let generated = [];

        for (let i = 0; i < amount; i++) {
            const key = `RENO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            generated.push(key);

            keys[key] = {
                user: null,
                createdAt: Date.now(),
                duration: durationMs,
                expiresAt: null,
                guild: message.guild.id
            };
        }

        saveKeys();

        message.reply(
            "Generated keys:\n```\n" + generated.join("\n") + "\n```"
        );
    }

    // Force expire a key
    if (command === "expirekey") {
        if (!isAdmin) return message.reply("Admins only.");
        if (!args[0]) return message.reply("Provide a key.");

        const key = args[0];
        const data = keys[key];

        if (!data) return message.reply("Key not found.");

        try {
            const guild = client.guilds.cache.get(data.guild);
            if (guild) {
                const member = await guild.members.fetch(data.user);
                if (member) await member.roles.remove(VIP_ROLE_ID);
            }
        } catch {}

        delete keys[key];
        saveKeys();

        message.reply(`Key **${key}** has been force-expired.`);
    }

    // List all keys
    if (command === "listkeys") {
        if (!isAdmin) return message.reply("Admins only.");

        if (Object.keys(keys).length === 0)
            return message.reply("No keys exist.");

        let text = "Active Keys:\n\n";
        for (const key in keys) {
            const d = keys[key];
            text += `**${key}** — ${d.user ? "USED" : "UNUSED"}\n`;
        }

        message.reply(text);
    }

    // -------- USER COMMANDS --------

    // Use a key
    if (command === "usekey") {
        if (!args[0]) return message.reply("Provide a key.");

        const key = args[0];
        const data = keys[key];

        if (!data) return message.reply("Invalid or expired key.");
        if (data.user) return message.reply("This key is already used.");

        try {
            await message.member.roles.add(VIP_ROLE_ID);
        } catch {
            return message.reply("Bot cannot add the VIP role.");
        }

        data.user = message.author.id;
        data.expiresAt = Date.now() + data.duration;

        saveKeys();

        message.reply(
            `VIP Activated!\nExpires: **${new Date(data.expiresAt).toLocaleString()}**`
        );
    }
});

// Login
client.login(TOKEN);

// --- EXPRESS SERVER FOR RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Reno Key System is running."));
app.listen(PORT);
console.log("Express running on", PORT);
