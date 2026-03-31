const express = require('express');
const prisma = require('../prisma');
const { attachCrud } = require('../lib/crud');

const router = express.Router();
attachCrud(router, prisma.team, [], { orderBy: { name: 'asc' } });
module.exports = router;
