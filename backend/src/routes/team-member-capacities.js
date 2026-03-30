const express = require('express');
const prisma = require('../prisma');
const { attachCrud } = require('../lib/crud');

const router = express.Router();
attachCrud(router, prisma.teamMemberCapacity, ['team_member_id', 'quarter']);
module.exports = router;
