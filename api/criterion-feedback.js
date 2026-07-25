"use strict";
const { proxyJson } = require("./_proxy");
module.exports = (req, res) => proxyJson(req, res, "/api/criterion-feedback");
module.exports.config = { maxDuration: 180 };
