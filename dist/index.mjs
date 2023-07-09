#!/usr/bin/env node

import { porcelain } from "@teaxyz/lib"
const { run } = porcelain
const args = process.argv.slice(2)

//TODO adapt the start script to install tea/cli with libtea then `sh exec tea $@`
//TODO ideally we wouldn’t run node at all if already installed

const { status } = await run(['tea={{version}}', ...args], { status: true })

process.exit(status)
