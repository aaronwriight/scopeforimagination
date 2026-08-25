import { rmSync } from 'node:fs'

const cacheDirectory = new URL('../.next/cache/', import.meta.url)

rmSync(cacheDirectory, { recursive: true, force: true })
