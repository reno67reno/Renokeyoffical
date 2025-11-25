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

let keys = {};
if (fs.existsSync("keys.json")) {
    keys = JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "createkey") {
        if (!args[0]) return message.reply("Provide a key!");
        keys[args[0]] = { user: null };
        fs.writeFileSync("keys.json", JSON.stringify(keys, null, 2));
        message.reply(`Key \`${args[0]}\` created!`);
    }

    if (command === "usekey") {
        if (!args[0]) return message.reply("Provide a key!");
        const key = keys[args[0]];
        if (!key) return message.reply("Invalid key!");
        if (key.user) return message.reply("Key already used!");
        key.user = message.author.id;
        fs.writeFileSync("keys.json", JSON.stringify(keys, null, 2));
        message.reply("Key activated! ✅");
    }

    if (command === "checkkey") {
        if (!args[0]) return message.reply("Provide a key!");
        const key = keys[args[0]];
        if (!key) return message.reply("Invalid key!");
        message.reply(key.user ? `Used by <@${key.user}>` : "Not used yet");
    }
});

client.login(TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Reno Key System Bot is running!"));
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));
