"use strict";
const { proxyJson } = require("./_proxy");
module.exports = (req, res) => proxyJson(req, res, "/api/live-check");
module.exports.config = { maxDuration: 180 };
